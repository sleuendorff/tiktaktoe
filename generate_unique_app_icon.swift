import AppKit
import Foundation

let arguments = CommandLine.arguments

guard arguments.count == 2 else {
    fputs("Usage: generate_unique_app_icon.swift <output>\n", stderr)
    exit(1)
}

let outputPath = arguments[1]
let side = CGFloat(1024)

guard let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: Int(side),
    pixelsHigh: Int(side),
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

// Solid dark-blue background
darkBlue.setFill()
NSBezierPath(rect: bounds).fill()

// Bright blue lower-right diagonal triangle
let bluePath = NSBezierPath()
bluePath.move(to: NSPoint(x: side, y: side))
bluePath.line(to: NSPoint(x: 0, y: 0))
bluePath.line(to: NSPoint(x: side, y: 0))
bluePath.close()
blue.setFill()
bluePath.fill()

// White diagonal stripe along the seam
let bandThickness: CGFloat = 90
let stripe = NSBezierPath()
stripe.move(to: NSPoint(x: -bandThickness, y: 0))
stripe.line(to: NSPoint(x: side + bandThickness, y: side))
stripe.line(to: NSPoint(x: side + bandThickness, y: side + bandThickness))
stripe.line(to: NSPoint(x: -bandThickness, y: bandThickness))
stripe.close()
white.withAlphaComponent(0.95).setFill()
stripe.fill()

// Giant O top-left (dark-blue side)
let oCenter = NSPoint(x: 300, y: 720)
let oOuter = NSBezierPath(ovalIn: NSRect(x: oCenter.x - 220, y: oCenter.y - 220, width: 440, height: 440))
white.setStroke()
oOuter.lineWidth = 74
oOuter.stroke()

let oInner = NSBezierPath(ovalIn: NSRect(x: oCenter.x - 152, y: oCenter.y - 152, width: 304, height: 304))
darkBlue.setStroke()
oInner.lineWidth = 44
oInner.stroke()

// Giant X bottom-right
func drawX(center: NSPoint, arm: CGFloat, color: NSColor, lineWidth: CGFloat) {
    color.setStroke()
    let path = NSBezierPath()
    path.lineWidth = lineWidth
    path.lineCapStyle = .round
    path.move(to: NSPoint(x: center.x - arm, y: center.y - arm))
    path.line(to: NSPoint(x: center.x + arm, y: center.y + arm))
    path.move(to: NSPoint(x: center.x - arm, y: center.y + arm))
    path.line(to: NSPoint(x: center.x + arm, y: center.y - arm))
    path.stroke()
}

let xCenter = NSPoint(x: 720, y: 320)
drawX(center: xCenter, arm: 210, color: white, lineWidth: 92)
drawX(center: xCenter, arm: 170, color: blue, lineWidth: 46)

// Title pill along the bottom
let pillRect = NSRect(x: 64, y: 72, width: side - 128, height: 200)
let pillPath = rounded(pillRect, radius: 76)

// White filled pill with subtle dark-blue → blue outer ring
NSGraphicsContext.saveGraphicsState()
pillPath.addClip()
let ringGradient = NSGradient(colors: [darkBlue, blue])
ringGradient?.draw(in: pillRect, angle: 0)
let innerRect = pillRect.insetBy(dx: 14, dy: 14)
white.setFill()
rounded(innerRect, radius: 66).fill()
NSGraphicsContext.restoreGraphicsState()

// Title text: TOE TAC TIC across dark blue / ink / blue
let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center

let titleFont = NSFont.systemFont(ofSize: 122, weight: .black)
let titleShadow = NSShadow()
titleShadow.shadowBlurRadius = 4
titleShadow.shadowOffset = NSSize(width: 0, height: -2)
titleShadow.shadowColor = NSColor(calibratedWhite: 0, alpha: 0.15)

let title = NSMutableAttributedString(
    string: "TOE ",
    attributes: [
        .font: titleFont,
        .foregroundColor: darkBlue,
        .paragraphStyle: paragraph,
        .kern: 6,
        .shadow: titleShadow,
    ]
)
title.append(NSAttributedString(string: "TAC ", attributes: [
    .font: titleFont,
    .foregroundColor: ink,
    .paragraphStyle: paragraph,
    .kern: 6,
    .shadow: titleShadow,
]))
title.append(NSAttributedString(string: "TIC", attributes: [
    .font: titleFont,
    .foregroundColor: blue,
    .paragraphStyle: paragraph,
    .kern: 6,
    .shadow: titleShadow,
]))

let titleRect = NSRect(x: pillRect.minX, y: pillRect.minY + 30, width: pillRect.width, height: 140)
title.draw(in: titleRect)

NSGraphicsContext.restoreGraphicsState()

guard let png = rep.representation(using: .png, properties: [:]) else {
    fputs("Could not encode PNG.\n", stderr)
    exit(1)
}

try png.write(to: URL(fileURLWithPath: outputPath))
fputs("Wrote icon: \(outputPath) (\(png.count) bytes)\n", stderr)
