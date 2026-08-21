import AppKit
import Foundation

let arguments = CommandLine.arguments

guard arguments.count == 3 else {
    fputs("Usage: overlay_icon.swift <input> <output>\n", stderr)
    exit(1)
}

let inputPath = arguments[1]
let outputPath = arguments[2]

guard let source = NSImage(contentsOfFile: inputPath) else {
    fputs("Could not read input image.\n", stderr)
    exit(1)
}

let firstRep = source.representations.first
let inferredSize = firstRep.map { max($0.pixelsWide, $0.pixelsHigh) } ?? 1024
let size = CGFloat(inferredSize > 1024 ? inferredSize / 2 : inferredSize)

let canvas = NSSize(width: size, height: size)
let output = NSImage(size: canvas)

output.lockFocus()
NSGraphicsContext.current?.imageInterpolation = .high

source.draw(in: NSRect(origin: .zero, size: canvas), from: .zero, operation: .sourceOver, fraction: 1)

let gradientRect = NSRect(x: 0, y: 0, width: size, height: size * 0.42)
let gradient = NSGradient(colors: [
    NSColor(calibratedWhite: 0.02, alpha: 0.0),
    NSColor(calibratedWhite: 0.02, alpha: 0.72),
    NSColor(calibratedWhite: 0.02, alpha: 0.9)
])
gradient?.draw(in: gradientRect, angle: 90)

let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center

let line1Font = NSFont.systemFont(ofSize: size * 0.11, weight: .black)
let line2Font = NSFont.systemFont(ofSize: size * 0.11, weight: .black)
let glow = NSShadow()
glow.shadowBlurRadius = size * 0.022
glow.shadowOffset = NSSize(width: 0, height: -size * 0.01)
glow.shadowColor = NSColor(calibratedWhite: 0, alpha: 0.45)

let line1 = NSAttributedString(string: "TOE TAC", attributes: [
    .font: line1Font,
    .foregroundColor: NSColor.white,
    .paragraphStyle: paragraph,
    .shadow: glow,
    .kern: size * 0.006,
])

let line2 = NSAttributedString(string: "TIC", attributes: [
    .font: line2Font,
    .foregroundColor: NSColor(calibratedRed: 1.0, green: 0.84, blue: 0.2, alpha: 1),
    .paragraphStyle: paragraph,
    .shadow: glow,
    .kern: size * 0.01,
])

let badgeHeight = size * 0.24
let badgeRect = NSRect(x: size * 0.11, y: size * 0.08, width: size * 0.78, height: badgeHeight)
let badge = NSBezierPath(roundedRect: badgeRect, xRadius: size * 0.045, yRadius: size * 0.045)
NSColor(calibratedWhite: 0.05, alpha: 0.5).setFill()
badge.fill()
NSColor(calibratedWhite: 1, alpha: 0.12).setStroke()
badge.lineWidth = size * 0.006
badge.stroke()

let line1Rect = NSRect(x: size * 0.14, y: size * 0.19, width: size * 0.72, height: size * 0.09)
let line2Rect = NSRect(x: size * 0.18, y: size * 0.105, width: size * 0.64, height: size * 0.09)
line1.draw(in: line1Rect)
line2.draw(in: line2Rect)

output.unlockFocus()

guard let tiff = output.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiff),
      let png = rep.representation(using: .png, properties: [:]) else {
    fputs("Could not encode output image.\n", stderr)
    exit(1)
}

try png.write(to: URL(fileURLWithPath: outputPath))
