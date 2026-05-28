const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/index.html';
let code = fs.readFileSync(path, 'utf8');

const pwaMeta = `
    <!-- PWA meta tags -->
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" sizes="192x192" href="/pwa-192x192.png">
    <link rel="icon" type="image/png" sizes="512x512" href="/pwa-512x512.png">
    <link rel="mask-icon" href="/mask-icon.svg" color="#FFFFFF">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="WVI Platform">
`;

code = code.replace(
  "<meta name=\"theme-color\" content=\"#1a1418\" media=\"(prefers-color-scheme: dark)\" />",
  "<meta name=\"theme-color\" content=\"#1a1418\" media=\"(prefers-color-scheme: dark)\" />\n" + pwaMeta
);

fs.writeFileSync(path, code);
