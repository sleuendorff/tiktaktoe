import AppKit
import Foundation

let arguments = CommandLine.arguments

guard arguments.count == 3 else {
    fputs("Usage: flatten_app_icon.swift <input> <output>\n", stderr)
    exit(1)
}

let inputPath = arguments[1]
let outputPath = arguments[2]

guard let source = NSImage(contentsOfFile: inputPath) else {
    fputs("Could not read input image.\n", stderr)
    exit(1)
}

let size = 1024
guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: size,
    pixelsHigh: size,
    bitsPerSample: 8,
    samplesPerPixel: 3,
    hasAlpha: false,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
) else {
    fputs("Could not create bitmap.\n", stderr)
    exit(1)
}

bitmap.size = NSSize(width: size, height: size)
let image = NSImage(size: NSSize(width: size, height: size))
image.addRepresentation(bitmap)

image.lockFocus()

let rect = NSRect(x: 0, y: 0, width: size, height: size)
NSColor(calibratedRed: 0.043, green: 0.043, blue: 0.078, alpha: 1).setFill()
rect.fill()

source.draw(in: rect, from: .zero, operation: .sourceOver, fraction: 1)

let badgeRect = NSRect(x: 112, y: 86, width: 800, height: 248)
let badge = NSBezierPath(roundedRect: badgeRect, xRadius: 44, yRadius: 44)
NSColor(calibratedWhite: 0.05, alpha: 0.82).setFill()
badge.fill()
NSColor(calibratedWhite: 1.0, alpha: 0.12).setStroke()
badge.lineWidth = 6
badge.stroke()

let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center

let shadow = NSShadow()
shadow.shadowBlurRadius = 14
shadow.shadowOffset = NSSize(width: 0, height: -8)
shadow.shadowColor = NSColor(calibratedWhite: 0, alpha: 0.42)

let topText = NSAttributedString(string: "TOE TAC", attributes: [
    .font: NSFont.systemFont(ofSize: 106, weight: .black),
    .foregroundColor: NSColor.white,
    .paragraphStyle: paragraph,
    .shadow: shadow,
    .kern: 6,
])

let bottomText = NSAttributedString(string: "TIC", attributes: [
    .font: NSFont.systemFont(ofSize: 124, weight: .black),
    .foregroundColor: NSColor(calibratedRed: 1.0, green: 0.84, blue: 0.2, alpha: 1),
    .paragraphStyle: paragraph,
    .shadow: shadow,
    .kern: 10,
])

topText.draw(in: NSRect(x: 150, y: 190, width: 724, height: 84))
bottomText.draw(in: NSRect(x: 186, y: 110, width: 652, height: 98))

image.unlockFocus()

guard let png = bitmap.representation(using: .png, properties: [:]) else {
    fputs("Could not encode PNG.\n", stderr)
    exit(1)
}

try png.write(to: URL(fileURLWithPath: outputPath))
