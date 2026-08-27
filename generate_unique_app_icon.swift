import AppKit
import Foundation

let arguments = CommandLine.arguments

guard arguments.count == 2 else {
    fputs("Usage: generate_unique_app_icon.swift <output>\n", stderr)
    exit(1)
}

let outputPath = arguments[1]
let size = CGFloat(1024)
let canvas = NSSize(width: size, height: size)

guard let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: Int(size),
    pixelsHigh: Int(size),
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
) else {
    fputs("Could not create bitmap.\n", stderr)
    exit(1)
}

rep.size = canvas
let image = NSImage(size: canvas)
image.addRepresentation(rep)

func roundedRect(_ rect: NSRect, radius: CGFloat) -> NSBezierPath {
    NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
}

func drawGrid(in rect: NSRect, lineWidth: CGFloat, color: NSColor) {
    color.setStroke()
    let path = NSBezierPath()
    path.lineWidth = lineWidth
    path.lineCapStyle = .round

    let thirdW = rect.width / 3
    let thirdH = rect.height / 3

    for index in 1..<3 {
        let x = rect.minX + thirdW * CGFloat(index)
        path.move(to: NSPoint(x: x, y: rect.minY))
        path.line(to: NSPoint(x: x, y: rect.maxY))
    }

    for index in 1..<3 {
        let y = rect.minY + thirdH * CGFloat(index)
        path.move(to: NSPoint(x: rect.minX, y: y))
        path.line(to: NSPoint(x: rect.maxX, y: y))
    }

    path.stroke()
}

func drawX(center: NSPoint, size: CGFloat, color: NSColor, lineWidth: CGFloat) {
    color.setStroke()
    let path = NSBezierPath()
    path.lineWidth = lineWidth
    path.lineCapStyle = .round
    let offset = size / 2
    path.move(to: NSPoint(x: center.x - offset, y: center.y - offset))
    path.line(to: NSPoint(x: center.x + offset, y: center.y + offset))
    path.move(to: NSPoint(x: center.x - offset, y: center.y + offset))
    path.line(to: NSPoint(x: center.x + offset, y: center.y - offset))
    path.stroke()
}

func drawO(center: NSPoint, size: CGFloat, color: NSColor, lineWidth: CGFloat) {
    color.setStroke()
    let path = NSBezierPath(ovalIn: NSRect(x: center.x - size / 2, y: center.y - size / 2, width: size, height: size))
    path.lineWidth = lineWidth
    path.stroke()
}

func drawSpark(center: NSPoint, radius: CGFloat, color: NSColor) {
    color.setFill()
    let path = NSBezierPath()
    for index in 0..<8 {
        let angle = CGFloat(index) * .pi / 4
        let pointRadius = index.isMultiple(of: 2) ? radius : radius * 0.42
        let point = NSPoint(
            x: center.x + cos(angle) * pointRadius,
            y: center.y + sin(angle) * pointRadius
        )
        if index == 0 {
            path.move(to: point)
        } else {
            path.line(to: point)
        }
    }
    path.close()
    path.fill()
}

image.lockFocus()
NSGraphicsContext.current?.imageInterpolation = .high

let bounds = NSRect(origin: .zero, size: canvas)
let background = NSGradient(colors: [
    NSColor(calibratedRed: 0.16, green: 0.31, blue: 1.0, alpha: 1),
    NSColor(calibratedRed: 0.55, green: 0.24, blue: 0.98, alpha: 1),
    NSColor(calibratedRed: 0.99, green: 0.23, blue: 0.66, alpha: 1),
])
background?.draw(in: bounds, angle: 40)

let topGlow = NSBezierPath(ovalIn: NSRect(x: 18, y: 660, width: 390, height: 290))
NSColor(calibratedWhite: 1, alpha: 0.24).setFill()
topGlow.fill()

let sideGlow = NSBezierPath(ovalIn: NSRect(x: 688, y: 86, width: 250, height: 250))
NSColor(calibratedRed: 0.22, green: 0.84, blue: 1, alpha: 0.2).setFill()
sideGlow.fill()

let pinkGlow = NSBezierPath(ovalIn: NSRect(x: 624, y: 736, width: 270, height: 184))
NSColor(calibratedRed: 1, green: 0.5, blue: 0.82, alpha: 0.2).setFill()
pinkGlow.fill()

drawSpark(center: NSPoint(x: 190, y: 824), radius: 32, color: NSColor(calibratedWhite: 1, alpha: 0.78))
drawSpark(center: NSPoint(x: 846, y: 246), radius: 22, color: NSColor(calibratedWhite: 1, alpha: 0.62))

let boardShadow = NSShadow()
boardShadow.shadowColor = NSColor(calibratedWhite: 0, alpha: 0.25)
boardShadow.shadowBlurRadius = 34
boardShadow.shadowOffset = NSSize(width: 0, height: -16)
boardShadow.set()

let boardRect = NSRect(x: 118, y: 220, width: 788, height: 690)
let boardPath = roundedRect(boardRect, radius: 126)
NSColor(calibratedWhite: 1, alpha: 0.97).setFill()
boardPath.fill()

NSColor(calibratedWhite: 1, alpha: 0.36).setStroke()
boardPath.lineWidth = 8
boardPath.stroke()

NSGraphicsContext.current?.saveGraphicsState()
boardPath.addClip()

let boardGradient = NSGradient(colors: [
    NSColor(calibratedWhite: 1, alpha: 0.98),
    NSColor(calibratedRed: 0.93, green: 0.96, blue: 1, alpha: 0.98),
])
boardGradient?.draw(in: boardRect, angle: 90)

let insetRect = boardRect.insetBy(dx: 82, dy: 58)
drawGrid(in: insetRect, lineWidth: 24, color: NSColor(calibratedRed: 0.44, green: 0.62, blue: 1, alpha: 0.4))

let cellW = insetRect.width / 3
let cellH = insetRect.height / 3
let marks: [(Int, Int, String)] = [
    (0, 0, "X"),
    (1, 0, "O"),
    (2, 0, "X"),
    (0, 1, "X"),
    (1, 1, "O"),
    (2, 1, "O"),
    (1, 2, "X"),
    (2, 2, "O"),
]

for (col, row, mark) in marks {
    let center = NSPoint(
        x: insetRect.minX + cellW * (CGFloat(col) + 0.5),
        y: insetRect.maxY - cellH * (CGFloat(row) + 0.5)
    )

    if mark == "X" {
        drawX(center: center, size: 136, color: NSColor(calibratedRed: 0.99, green: 0.24, blue: 0.64, alpha: 1), lineWidth: 28)
    } else {
        drawO(center: center, size: 128, color: NSColor(calibratedRed: 0.17, green: 0.76, blue: 1, alpha: 1), lineWidth: 24)
    }
}

NSColor(calibratedWhite: 1, alpha: 0.92).setStroke()
let winPath = NSBezierPath()
winPath.lineWidth = 30
winPath.lineCapStyle = .round
winPath.move(to: NSPoint(x: insetRect.minX + cellW * 0.38, y: insetRect.maxY - cellH * 0.52))
winPath.line(to: NSPoint(x: insetRect.maxX - cellW * 0.34, y: insetRect.maxY - cellH * 2.48))
winPath.stroke()

NSGraphicsContext.current?.restoreGraphicsState()

let badgeRect = NSRect(x: 86, y: 70, width: 852, height: 166)
let badgePath = roundedRect(badgeRect, radius: 66)
badgePath.addClip()
let badgeGradient = NSGradient(colors: [
    NSColor(calibratedRed: 1, green: 0.27, blue: 0.69, alpha: 0.94),
    NSColor(calibratedRed: 0.28, green: 0.34, blue: 1.0, alpha: 0.94),
])
badgeGradient?.draw(in: badgeRect, angle: 0)

NSColor(calibratedWhite: 1, alpha: 0.28).setStroke()
let badgeBorder = roundedRect(badgeRect, radius: 66)
badgeBorder.lineWidth = 6
badgeBorder.stroke()

let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center

let titleShadow = NSShadow()
titleShadow.shadowBlurRadius = 16
titleShadow.shadowOffset = NSSize(width: 0, height: -6)
titleShadow.shadowColor = NSColor(calibratedWhite: 0, alpha: 0.32)

let title = NSAttributedString(string: "TOE TAC TIC", attributes: [
    .font: NSFont.systemFont(ofSize: 96, weight: .black),
    .foregroundColor: NSColor.white,
    .paragraphStyle: paragraph,
    .kern: 4,
    .shadow: titleShadow,
])
title.draw(in: NSRect(x: 120, y: 108, width: 784, height: 102))

image.unlockFocus()

guard let png = rep.representation(using: .png, properties: [:]) else {
    fputs("Could not encode PNG.\n", stderr)
    exit(1)
}

try png.write(to: URL(fileURLWithPath: outputPath))
