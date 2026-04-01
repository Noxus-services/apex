// Simple script to create basic PWA icons using canvas or pure SVG written as PNG
// Since we don't have canvas in Node, let's create SVG icons that work as PNG
import { writeFileSync, mkdirSync } from 'fs'

mkdirSync('public/icons', { recursive: true })

// Create a simple SVG icon with APEX branding
const svg192 = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" fill="#0a0a0a"/>
  <rect width="192" height="192" rx="32" fill="#111111"/>
  <text x="96" y="82" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="56" font-weight="900" fill="#e8ff47" letter-spacing="2">A</text>
  <text x="96" y="130" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="400" fill="rgba(240,237,230,0.6)" letter-spacing="8">APEX</text>
  <text x="96" y="155" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="rgba(240,237,230,0.3)" letter-spacing="3">COACH IA</text>
</svg>`

const svg512 = svg192.replace('width="192" height="192" viewBox="0 0 192 192"', 'width="512" height="512" viewBox="0 0 192 192"')

// Write SVGs (browsers accept SVG for icons in some contexts)
writeFileSync('public/icons/icon-192.svg', svg192)
writeFileSync('public/icons/icon-512.svg', svg512)

// Also write a simple favicon
writeFileSync('public/favicon.svg', svg192)

console.log('Icons generated!')
