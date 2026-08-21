import AppKit
import Foundation

let arguments = CommandLine.arguments

guard arguments.count == 3 else {
    fputs("Usage: overlay_splash.swift <input> <output>\n", stderr)
    exit(1)
}

let inputPath = arguments[1]
let outputPath = arguments[2]

guard let source = NSImage(contentsOfFile: inputPath) else {
    fputs("Could not read input image.\n", stderr)
    exit(1)
}

let inferredSize = source.representations.first.map { max($0.pixelsWide, $0.pixelsHigh) } ?? 2732
let size = CGFloat(inferredSize)
let canvas = NSSize(width: size, height: size)
let output = NSImage(size: canvas)

output.lockFocus()
NSGraphicsContext.current?.imageInterpolation = .high

source.draw(in: NSRect(origin: .zero, size: canvas), from: .zero, operation: .sourceOver, fraction: 1)

let badgeRect = NSRect(x: size * 0.11, y: size * 0.14, width: size * 0.78, height: size * 0.22)
let badge = NSBezierPath(roundedRect: badgeRect, xRadius: size * 0.05, yRadius: size * 0.05)
NSColor(calibratedWhite: 0.05, alpha: 0.56).setFill()
badge.fill()
NSColor(calibratedWhite: 1.0, alpha: 0.12).setStroke()
badge.lineWidth = size * 0.006
badge.stroke()

let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center

let glow = NSShadow()
glow.shadowBlurRadius = size * 0.018
glow.shadowOffset = NSSize(width: 0, height: -size * 0.008)
glow.shadowColor = NSColor(calibratedWhite: 0, alpha: 0.42)

let topText = NSAttributedString(string: "TOE TAC", attributes: [
    .font: NSFont.systemFont(ofSize: size * 0.088, weight: .black),
    .foregroundColor: NSColor.white,
    .paragraphStyle: paragraph,
    .shadow: glow,
    .kern: size * 0.006,
])

let bottomText = NSAttributedString(string: "TIC", attributes: [
    .font: NSFont.systemFont(ofSize: size * 0.104, weight: .black),
    .foregroundColor: NSColor(calibratedRed: 1.0, green: 0.84, blue: 0.2, alpha: 1),
    .paragraphStyle: paragraph,
    .shadow: glow,
    .kern: size * 0.012,
])

topText.draw(in: NSRect(x: size * 0.16, y: size * 0.245, width: size * 0.68, height: size * 0.08))
bottomText.draw(in: NSRect(x: size * 0.18, y: size * 0.155, width: size * 0.64, height: size * 0.1))

output.unlockFocus()

guard let tiff = output.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiff),
      let png = rep.representation(using: .png, properties: [:]) else {
    fputs("Could not encode output image.\n", stderr)
    exit(1)
}

try png.write(to: URL(fileURLWithPath: outputPath))
