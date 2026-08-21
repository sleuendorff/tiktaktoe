import Foundation
import Capacitor
import GameKit

@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate, GKMatchmakerViewControllerDelegate, GKMatchDelegate {
    public let identifier = "GameCenterPlugin"
    public let jsName = "GameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "loadLeaderboard", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startMatchmaking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelMatchmaking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sendMatchEvent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endMatch", returnType: CAPPluginReturnPromise)
    ]

    private let leaderboardID = "total_score"
    private var authCall: CAPPluginCall?
    private var matchmakingCall: CAPPluginCall?
    private weak var matchmakerViewController: GKMatchmakerViewController?
    private var currentMatch: GKMatch?

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve([
            "available": true,
            "authenticated": GKLocalPlayer.local.isAuthenticated
        ])
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        authCall = call

        GKLocalPlayer.local.authenticateHandler = { [weak self] viewController, error in
            guard let self else { return }

            if let viewController = viewController {
                DispatchQueue.main.async {
                    self.bridge?.viewController?.present(viewController, animated: true)
                }
                return
            }

            if let error = error {
                self.authCall?.reject(error.localizedDescription)
                self.authCall = nil
                self.notifyListeners("authChanged", data: [
                    "authenticated": false,
                    "message": error.localizedDescription
                ])
                return
            }

            let player = GKLocalPlayer.local
            let payload: [String: Any] = [
                "authenticated": player.isAuthenticated,
                "alias": player.alias,
                "gamePlayerID": player.gamePlayerID,
                "isUnderage": player.isUnderage,
                "multiplayerRestricted": player.isMultiplayerGamingRestricted
            ]
            self.authCall?.resolve(payload)
            self.authCall = nil
            self.notifyListeners("authChanged", data: payload)
        }
    }

    @objc func loadLeaderboard(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else {
            call.reject("Game Center is not authenticated")
            return
        }

        let page = max(call.getInt("page") ?? 0, 0)
        let pageSize = max(call.getInt("pageSize") ?? 10, 1)
        let range = NSRange(location: page * pageSize + 1, length: pageSize)

        GKLeaderboard.loadLeaderboards(IDs: [leaderboardID]) { leaderboards, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }

            guard let leaderboard = leaderboards?.first else {
                call.resolve(["entries": []])
                return
            }

            leaderboard.loadEntries(for: .global, timeScope: .allTime, range: range) { localEntry, entries, totalPlayerCount, error in
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }

                let mapped = (entries ?? []).map { entry in
                    [
                        "rank": entry.rank,
                        "score": entry.score,
                        "displayName": entry.player.displayName,
                        "alias": entry.player.alias,
                        "gamePlayerID": entry.player.gamePlayerID
                    ] as [String : Any]
                }

                call.resolve([
                    "entries": mapped,
                    "localRank": localEntry?.rank as Any,
                    "localScore": localEntry?.score as Any,
                    "totalPlayerCount": totalPlayerCount
                ])
            }
        }
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else {
            call.reject("Game Center is not authenticated")
            return
        }

        let score = call.getInt("score") ?? 0
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [leaderboardID]) { error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            call.resolve(["submitted": true])
        }
    }

    @objc func startMatchmaking(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else {
            call.reject("Game Center is not authenticated")
            return
        }

        if GKLocalPlayer.local.isMultiplayerGamingRestricted {
            call.reject("Multiplayer is restricted for this Game Center account")
            return
        }

        matchmakingCall = call
        let request = GKMatchRequest()
        request.minPlayers = 2
        request.maxPlayers = 2
        request.defaultNumberOfPlayers = 2

        DispatchQueue.main.async {
            guard let controller = GKMatchmakerViewController(matchRequest: request) else {
                self.matchmakingCall?.reject("Unable to create matchmaker")
                self.matchmakingCall = nil
                return
            }
            controller.matchmakerDelegate = self
            self.matchmakerViewController = controller
            self.bridge?.viewController?.present(controller, animated: true)
            self.notifyListeners("matchStatusChanged", data: [
                "status": "searching",
                "message": "Looking for an opponent"
            ])
        }
    }

    @objc func cancelMatchmaking(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.matchmakerViewController?.dismiss(animated: true)
            self.matchmakerViewController = nil
            self.matchmakingCall?.reject("Matchmaking cancelled")
            self.matchmakingCall = nil
            self.notifyListeners("matchStatusChanged", data: [
                "status": "cancelled",
                "message": "Matchmaking cancelled"
            ])
            call.resolve(["cancelled": true])
        }
    }

    @objc func sendMatchEvent(_ call: CAPPluginCall) {
        guard let match = currentMatch else {
            call.reject("No active match")
            return
        }

        guard let event = call.options["event"] else {
            call.reject("Missing event payload")
            return
        }

        do {
            let data = try JSONSerialization.data(withJSONObject: event, options: [])
            try match.sendData(toAllPlayers: data, with: .reliable)
            call.resolve(["sent": true])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func endMatch(_ call: CAPPluginCall) {
        currentMatch?.delegate = nil
        currentMatch?.disconnect()
        currentMatch = nil
        notifyListeners("matchStatusChanged", data: [
            "status": "ended",
            "message": "Match closed"
        ])
        call.resolve(["ended": true])
    }

    public func matchmakerViewControllerWasCancelled(_ viewController: GKMatchmakerViewController) {
        viewController.dismiss(animated: true)
        matchmakingCall?.reject("Matchmaking cancelled")
        matchmakingCall = nil
        notifyListeners("matchStatusChanged", data: [
            "status": "cancelled",
            "message": "Matchmaking cancelled"
        ])
    }

    public func matchmakerViewController(_ viewController: GKMatchmakerViewController, didFailWithError error: Error) {
        viewController.dismiss(animated: true)
        matchmakingCall?.reject(error.localizedDescription)
        matchmakingCall = nil
        notifyListeners("matchStatusChanged", data: [
            "status": "error",
            "message": error.localizedDescription
        ])
    }

    public func matchmakerViewController(_ viewController: GKMatchmakerViewController, didFind match: GKMatch) {
        viewController.dismiss(animated: true)
        currentMatch = match
        match.delegate = self
        let opponents = match.players.map { player in
            [
                "displayName": player.displayName,
                "alias": player.alias,
                "gamePlayerID": player.gamePlayerID
            ] as [String : Any]
        }
        matchmakingCall?.resolve([
            "matched": true,
            "opponents": opponents,
            "localPlayerID": GKLocalPlayer.local.gamePlayerID
        ])
        matchmakingCall = nil
        notifyListeners("matchStatusChanged", data: [
            "status": "matched",
            "message": "Opponent found",
            "opponents": opponents,
            "localPlayerID": GKLocalPlayer.local.gamePlayerID
        ])
    }

    public func match(_ match: GKMatch, didReceive data: Data, fromRemotePlayer player: GKPlayer) {
        guard let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return
        }
        notifyListeners("matchEvent", data: [
            "playerID": player.gamePlayerID,
            "payload": payload
        ])
    }

    public func match(_ match: GKMatch, player: GKPlayer, didChange state: GKPlayerConnectionState) {
        let stateName: String
        switch state {
        case .connected:
            stateName = "connected"
        case .disconnected:
            stateName = "disconnected"
        case .unknown:
            fallthrough
        @unknown default:
            stateName = "unknown"
        }

        notifyListeners("matchPresenceChanged", data: [
            "playerID": player.gamePlayerID,
            "state": stateName,
            "displayName": player.displayName
        ])
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}
