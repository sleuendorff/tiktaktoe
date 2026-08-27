import AppKit
import Foundation

let arguments = CommandLine.arguments

guard arguments.count == 3 else {
    fputs("Usage: generate_splash.swift <output> <pixelSize>\n", stderr)
    exit(1)
}

let outputPath = arguments[1]
guard let px = Int(arguments[2]), px > 0 else {
    fputs("Invalid pixel size.\n", stderr)
    exit(1)
}

let side = CGFloat(px)

guard let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: px,
    pixelsHigh: px,
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

rep.size = NSSize(width: side, height: side)

guard let context = NSGraphicsContext(bitmapImageRep: rep) else {
    fputs("Could not create graphics context.\n", stderr)
    exit(1)
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
context.imageInterpolation = .high

let darkBlue = NSColor(calibratedRed: 0.06, green: 0.13, blue: 0.42, alpha: 1)
let blue     = NSColor(calibratedRed: 0.20, green: 0.42, blue: 1.00, alpha: 1)
let white    = NSColor.white
let ink      = NSColor(calibratedRed: 0.10, green: 0.16, blue: 0.32, alpha: 1)

func rounded(_ rect: NSRect, radius: CGFloat) -> NSBezierPath {
    NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
}

let bounds = NSRect(x: 0, y: 0, width: side, height: side)

// Vertical gradient background: dark blue to blue
let bgGradient = NSGradient(colors: [darkBlue, blue])
bgGradient?.draw(in: bounds, angle: 90)

// Center logo mark: circle badge with X inside O
let center = NSPoint(x: side / 2, y: side / 2 + side * 0.05)
let ringRadius = side * 0.15

let outerRing = NSBezierPath(ovalIn: NSRect(
    x: center.x - ringRadius,
    y: center.y - ringRadius,
    width: ringRadius * 2,
    height: ringRadius * 2
))
white.setStroke()
outerRing.lineWidth = side * 0.018
outerRing.stroke()

let innerRingRadius = ringRadius * 0.78
let innerRing = NSBezierPath(ovalIn: NSRect(
    x: center.x - innerRingRadius,
    y: center.y - innerRingRadius,
    width: innerRingRadius * 2,
    height: innerRingRadius * 2
))
darkBlue.setStroke()
innerRing.lineWidth = side * 0.011
innerRing.stroke()

// X inside the O
let xArm = ringRadius * 0.42
let xPath = NSBezierPath()
xPath.lineCapStyle = .round
xPath.lineWidth = side * 0.02
xPath.move(to: NSPoint(x: center.x - xArm, y: center.y - xArm))
xPath.line(to: NSPoint(x: center.x + xArm, y: center.y + xArm))
xPath.move(to: NSPoint(x: center.x - xArm, y: center.y + xArm))
xPath.line(to: NSPoint(x: center.x + xArm, y: center.y - xArm))
white.setStroke()
xPath.stroke()

let xInnerArm = xArm * 0.78
let xInner = NSBezierPath()
xInner.lineCapStyle = .round
xInner.lineWidth = side * 0.011
xInner.move(to: NSPoint(x: center.x - xInnerArm, y: center.y - xInnerArm))
xInner.line(to: NSPoint(x: center.x + xInnerArm, y: center.y + xInnerArm))
xInner.move(to: NSPoint(x: center.x - xInnerArm, y: center.y + xInnerArm))
xInner.line(to: NSPoint(x: center.x + xInnerArm, y: center.y - xInnerArm))
blue.setStroke()
xInner.stroke()

// Title pill under the mark
let pillWidth = side * 0.68
let pillHeight = side * 0.11
let pillRect = NSRect(
    x: (side - pillWidth) / 2,
    y: side * 0.20,
    width: pillWidth,
    height: pillHeight
)
let pillPath = rounded(pillRect, radius: pillHeight / 2)

NSGraphicsContext.saveGraphicsState()
pillPath.addClip()
let ringGradient = NSGradient(colors: [darkBlue, blue])
ringGradient?.draw(in: pillRect, angle: 0)
let innerRect = pillRect.insetBy(dx: side * 0.008, dy: side * 0.008)
white.setFill()
rounded(innerRect, radius: (pillHeight - side * 0.016) / 2).fill()
NSGraphicsContext.restoreGraphicsState()

let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center

let titleFont = NSFont.systemFont(ofSize: side * 0.06, weight: .black)
let title = NSMutableAttributedString(
    string: "TOE ",
    attributes: [
        .font: titleFont,
        .foregroundColor: darkBlue,
        .paragraphStyle: paragraph,
        .kern: side * 0.004,
    ]
)
title.append(NSAttributedString(string: "TAC ", attributes: [
    .font: titleFont,
    .foregroundColor: ink,
    .paragraphStyle: paragraph,
    .kern: side * 0.004,
]))
title.append(NSAttributedString(string: "TIC", attributes: [
    .font: titleFont,
    .foregroundColor: blue,
    .paragraphStyle: paragraph,
    .kern: side * 0.004,
]))

let titleRect = NSRect(
    x: pillRect.minX,
    y: pillRect.minY + pillHeight * 0.24,
    width: pillRect.width,
    height: pillHeight * 0.72
)
title.draw(in: titleRect)

NSGraphicsContext.restoreGraphicsState()

guard let png = rep.representation(using: .png, properties: [:]) else {
    fputs("Could not encode PNG.\n", stderr)
    exit(1)
}

try png.write(to: URL(fileURLWithPath: outputPath))
fputs("Wrote splash: \(outputPath) (\(png.count) bytes)\n", stderr)
