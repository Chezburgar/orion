/* ===== Icon registry: inline SVG, no external assets ===== */
(function (global) {
  'use strict';

  // Stroke glyphs (24x24) -------------------------------------------------
  var S = {
    search: '<circle cx="11" cy="11" r="6.4"/><path d="M15.8 15.8 21 21"/>',
    taskview: '<rect x="2.6" y="6" width="12" height="12" rx="1.6"/><path d="M17 8v8M20 10v4"/>',
    widgets: '<rect x="3" y="3" width="8" height="8" rx="1.6"/><rect x="13" y="3" width="8" height="8" rx="1.6"/><rect x="3" y="13" width="8" height="8" rx="1.6"/><rect x="13" y="13" width="8" height="8" rx="1.6"/>',
    wifi: '<path d="M2.5 8.8a15 15 0 0 1 19 0M5.6 12.4a10.5 10.5 0 0 1 12.8 0M8.8 16a5.8 5.8 0 0 1 6.4 0"/><circle cx="12" cy="19.4" r="1.1" fill="currentColor" stroke="none"/>',
    volume: '<path d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4z" fill="currentColor" stroke="none"/><path d="M15.4 9.4a4 4 0 0 1 0 5.2M18 7a7.6 7.6 0 0 1 0 10"/>',
    mute: '<path d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4z" fill="currentColor" stroke="none"/><path d="m16 9.5 5 5m0-5-5 5"/>',
    battery: '<rect x="2" y="7.6" width="17" height="8.8" rx="2.2"/><path d="M21.2 10.6v2.8" stroke-linecap="round"/><rect x="4" y="9.6" width="13" height="4.8" rx="1" fill="currentColor" stroke="none"/>',
    brightness: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/>',
    bell: '<path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.4 5.6 1.4 5.6H5.1S6.5 14 6.5 10Z"/><path d="M10 18.4a2.2 2.2 0 0 0 4 0"/>',
    chevronUp: '<path d="m6 14.5 6-6 6 6"/>',
    chevronDown: '<path d="m6 9.5 6 6 6-6"/>',
    chevronLeft: '<path d="m14.5 6-6 6 6 6"/>',
    chevronRight: '<path d="m9.5 6 6 6-6 6"/>',
    power: '<path d="M12 3v9"/><path d="M7.1 5.9a8 8 0 1 0 9.8 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="m5 5 14 14M19 5 5 19"/>',
    minus: '<path d="M5 12h14"/>',
    maximize: '<rect x="4.5" y="4.5" width="15" height="15" rx="1.6"/>',
    restore: '<rect x="4.5" y="7.5" width="12" height="12" rx="1.6"/><path d="M7.8 4.5h8.7a3 3 0 0 1 3 3v8.7"/>',
    back: '<path d="M20 12H4.6"/><path d="m10.6 5.6-6 6.4 6 6.4"/>',
    forward: '<path d="M4 12h15.4"/><path d="m13.4 5.6 6 6.4-6 6.4"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.4h-4.4"/>',
    stop: '<path d="m5 5 14 14M19 5 5 19"/>',
    home: '<path d="M4 11.2 12 4.4l8 6.8"/><path d="M6.2 10v9.6h11.6V10"/>',
    star: '<path d="m12 4.6 2.3 4.9 5.2.7-3.8 3.7 1 5.3-4.7-2.6-4.7 2.6 1-5.3-3.8-3.7 5.2-.7z"/>',
    globe: '<circle cx="12" cy="12" r="8.4"/><path d="M3.6 12h16.8M12 3.6c4.2 4.6 4.2 12.2 0 16.8-4.2-4.6-4.2-12.2 0-16.8Z"/>',
    lock: '<rect x="5" y="10.4" width="14" height="9.6" rx="2.2"/><path d="M8.2 10.4V8a3.8 3.8 0 0 1 7.6 0v2.4"/>',
    shield: '<path d="M12 3.4 5 6v6c0 4.2 3 7.2 7 8.6 4-1.4 7-4.4 7-8.6V6z"/>',
    more: '<circle cx="5.4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18.6" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    collections: '<rect x="4" y="4.6" width="9" height="14.8" rx="1.6"/><path d="M15.4 6.4h1.8a1.8 1.8 0 0 1 1.8 1.8v9.4"/>',
    history: '<path d="M3.6 12a8.4 8.4 0 1 0 2.6-6.1"/><path d="M3.4 4v4.4h4.4"/><path d="M12 7.6V12l3.2 2"/>',
    download: '<path d="M12 3.6v11"/><path d="m7.4 10.2 4.6 4.6 4.6-4.6"/><path d="M4.6 19.4h14.8"/>',
    upload: '<path d="M12 20V9"/><path d="m7.4 13.4 4.6-4.6 4.6 4.6"/><path d="M4.6 4.6h14.8"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.6 14.2a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V20a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H4a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.8-1.1V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.2a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1Z"/>',
    trash: '<path d="M4.6 6.6h14.8"/><path d="M9.4 6.6V4.8h5.2v1.8"/><path d="M6.6 6.6 7.6 20h8.8l1-13.4"/><path d="M10.4 10v6.4M13.6 10v6.4"/>',
    copy: '<rect x="8.4" y="8.4" width="11" height="11" rx="1.8"/><path d="M15.6 5.6H6.4a1.8 1.8 0 0 0-1.8 1.8v9.2"/>',
    cut: '<circle cx="6.6" cy="17.4" r="2.6"/><circle cx="17.4" cy="17.4" r="2.6"/><path d="M8.4 15.4 17 4M15.6 15.4 7 4"/>',
    paste: '<rect x="5.4" y="5" width="13.2" height="15" rx="1.8"/><path d="M9 5V3.6h6V5"/><path d="M9 11h6M9 14.6h4"/>',
    rename: '<path d="M4 20h16"/><path d="m5.4 15.6 9.8-9.8 3 3-9.8 9.8H5.4z"/>',
    newfolder: '<path d="M3.6 8V6.2A1.6 1.6 0 0 1 5.2 4.6h3.9l2 2.4h6.7a1.6 1.6 0 0 1 1.6 1.6v1"/><path d="M3.6 8h16.8v9.8a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6z"/><path d="M12 11.6v4.6M9.7 13.9h4.6" stroke="var(--layer-solid)" stroke-width="2.6"/><path d="M12 11.6v4.6M9.7 13.9h4.6"/>',
    sort: '<path d="M5 7.4h14M7 12h10M9.6 16.6h4.8"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.4"/><rect x="13" y="4" width="7" height="7" rx="1.4"/><rect x="4" y="13" width="7" height="7" rx="1.4"/><rect x="13" y="13" width="7" height="7" rx="1.4"/>',
    list: '<path d="M4.4 6.6h15.2M4.4 12h15.2M4.4 17.4h15.2"/>',
    info: '<circle cx="12" cy="12" r="8.4"/><path d="M12 11v5.4"/><circle cx="12" cy="7.9" r="1.1" fill="currentColor" stroke="none"/>',
    warning: '<path d="M12 4.2 21 19.4H3z"/><path d="M12 9.6v4.6"/><circle cx="12" cy="16.9" r="1.05" fill="currentColor" stroke="none"/>',
    check: '<path d="m5 12.6 4.6 4.6L19 6.8"/>',
    moon: '<path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4Z"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/>',
    bluetooth: '<path d="m7.6 7.4 8.8 9.2L12 21V3l4.4 4.4-8.8 9.2"/>',
    airplane: '<path d="M11 3.4a1 1 0 0 1 2 0V9l8 4.6v2L13 13v4.6l2.6 1.8v1.6L12 20l-3.6 1v-1.6l2.6-1.8V13l-8 2.6v-2L11 9z" fill="currentColor" stroke="none"/>',
    night: '<path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4Z"/><circle cx="17" cy="5.6" r="1" fill="currentColor" stroke="none"/>',
    cast: '<path d="M3.6 15.4a5 5 0 0 1 5 5M3.6 11.4a9 9 0 0 1 9 9"/><path d="M3.6 8.4V6.6A1.6 1.6 0 0 1 5.2 5h14a1.6 1.6 0 0 1 1.6 1.6v11.8a1.6 1.6 0 0 1-1.6 1.6h-3.4"/><circle cx="4" cy="19.9" r="1.1" fill="currentColor" stroke="none"/>',
    access: '<circle cx="12" cy="4.8" r="1.8" fill="currentColor" stroke="none"/><path d="M4.6 8.4h14.8M12 8.6v6M12 14.6l-3 6.2M12 14.6l3 6.2"/>',
    monitor: '<rect x="3" y="4.6" width="18" height="12" rx="1.8"/><path d="M9 20h6M12 16.8V20"/>',
    apps: '<rect x="3.4" y="3.4" width="7.6" height="7.6" rx="1.6"/><rect x="13" y="3.4" width="7.6" height="7.6" rx="1.6"/><rect x="3.4" y="13" width="7.6" height="7.6" rx="1.6"/><path d="M16.8 13v7.6M13 16.8h7.6"/>',
    brush: '<path d="M4 20s1.6-3 4-3 3.2 1.6 3.2 1.6"/><path d="M9.4 15.6 18 5.2a2.2 2.2 0 0 1 3.2 3L11 17"/>',
    privacy: '<rect x="5" y="10.4" width="14" height="9.6" rx="2.2"/><path d="M8.2 10.4V8a3.8 3.8 0 0 1 7.6 0"/>',
    update: '<path d="M3.6 12a8.4 8.4 0 0 1 14.4-5.9"/><path d="M20.4 12a8.4 8.4 0 0 1-14.4 5.9"/><path d="M18.4 2.6v4h-4M5.6 21.4v-4h4"/>',
    save: '<path d="M5.6 4.6h10.2L19.4 8v11.4H5.6z"/><path d="M8.6 4.6v5h6v-5M8.6 19.4v-5h6.8v5"/>',
    open: '<path d="M3.6 7.4V19h16.8v-8.6H11l-2-3z"/><path d="M3.6 7.4V5.4h5.2l2 3"/>',
    print: '<path d="M7 9V4.6h10V9"/><rect x="3.6" y="9" width="16.8" height="7.4" rx="1.6"/><path d="M7 14h10v5.4H7z"/>',
    play: '<path d="M7.4 4.8 19 12 7.4 19.2z" fill="currentColor" stroke="none"/>',
    pin: '<path d="M14.6 3.4 20.6 9.4l-2.6.9-3.5 3.5.4 3.4-1.5 1.5-7.6-7.6L7.3 9.6l3.4.4 3.5-3.5z"/><path d="m6.4 17.6-3 3"/>',
    key: '<circle cx="8" cy="12" r="4.4"/><path d="M12.4 12H21v3M17.4 12v2.6"/>',
    user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/>',
    people: '<circle cx="9.4" cy="8.4" r="3.4"/><path d="M3.4 19.4a6 6 0 0 1 12 0"/><path d="M15.6 5.4a3.4 3.4 0 0 1 0 6.6M17 14.4a6 6 0 0 1 3.6 5"/>',
    sound: '<path d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4z" fill="currentColor" stroke="none"/><path d="M15.4 9.4a4 4 0 0 1 0 5.2"/>',
    network: '<circle cx="12" cy="12" r="8.4"/><path d="M3.6 12h16.8M12 3.6c4.2 4.6 4.2 12.2 0 16.8-4.2-4.6-4.2-12.2 0-16.8Z"/>',
    game: '<path d="M8 10v4M6 12h4M15.4 11h.1M17.6 13.4h.1"/><path d="M6.6 6.6h10.8a4 4 0 0 1 3.9 3.1l1 4.6a2.9 2.9 0 0 1-5.2 2.3l-1.2-1.6H8.1l-1.2 1.6a2.9 2.9 0 0 1-5.2-2.3l1-4.6a4 4 0 0 1 3.9-3.1Z"/>',
    doc: '<path d="M6 3.6h7.4L18 8.2v12.2H6z"/><path d="M13.2 3.6v5H18"/><path d="M8.8 12.6h6.4M8.8 16h4.6"/>',
    image: '<rect x="3.4" y="5" width="17.2" height="14" rx="1.8"/><circle cx="8.6" cy="10" r="1.6"/><path d="m4.4 17.4 4.8-4.4 3.4 3 3-2.6 4 4"/>',
    find: '<circle cx="10.6" cy="10.6" r="6"/><path d="M15 15l5.4 5.4"/><path d="M8.2 10.6h4.8"/>',
    reader: '<rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2"/><path d="M7 9h5M7 12.4h10M7 15.8h8"/>',
    zoomIn: '<circle cx="10.6" cy="10.6" r="6"/><path d="M15 15l5.4 5.4M10.6 8.2v4.8M8.2 10.6h4.8"/>',
    zoomOut: '<circle cx="10.6" cy="10.6" r="6"/><path d="M15 15l5.4 5.4M8.2 10.6h4.8"/>',
    code: '<path d="m8.6 8.4-4.6 3.6 4.6 3.6M15.4 8.4l4.6 3.6-4.6 3.6M13.4 5l-2.8 14"/>',
    plug: '<path d="M9 3v5M15 3v5"/><path d="M6.6 8h10.8v3.4a5.4 5.4 0 0 1-10.8 0z"/><path d="M12 16.8V21"/>',

    // Editing toolbars (Write, Draw, Photo)
    bold: '<path d="M7.4 4.6h5.8a3.9 3.9 0 0 1 0 7.8H7.4zM7.4 12.4h6.7a4 4 0 0 1 0 8H7.4z" stroke-width="1.8"/>',
    italic: '<path d="M15.4 4.6h-4.8M13.4 19.4H8.6M14.4 4.6 9.6 19.4"/>',
    underline: '<path d="M7 4.6v6.8a5 5 0 0 0 10 0V4.6"/><path d="M5.6 20.4h12.8"/>',
    undo: '<path d="M4 9.6h9.4a5.4 5.4 0 0 1 0 10.8H7"/><path d="M8 4.6 3.4 9.6 8 14.6"/>',
    redo: '<path d="M20 9.6h-9.4a5.4 5.4 0 0 0 0 10.8H17"/><path d="m16 4.6 4.6 5-4.6 5"/>',
    strike: '<path d="M4.6 12h14.8"/><path d="M8 8.4a3.6 3.6 0 0 1 3.8-3.4c2.4 0 3.7 1.2 4.1 2.8M16.4 15a3.8 3.8 0 0 1-4.2 4c-2.6 0-4.2-1.4-4.5-3.2"/>',
    numlist: '<path d="M9.6 6.6h10M9.6 12h10M9.6 17.4h10"/><path d="M4 5.2h1.4v3.6M4 17h2.4v3H4v-3M4 14.6h2.4l-2.4 2.4"/>',
    alignleft: '<path d="M4 6.6h16M4 12h10M4 17.4h13"/>',
    aligncenter: '<path d="M4 6.6h16M7 12h10M5.5 17.4h13"/>',
    alignright: '<path d="M4 6.6h16M10 12h10M7 17.4h13"/>',
    clearfmt: '<path d="M8 6h11M13.4 6 10 18"/><path d="m15.6 14.6 5 5m0-5-5 5"/>',
    cursor: '<path d="m5 3.4 6.6 17 2.4-6.8 6.8-2.4z"/>',
    shaperect: '<rect x="4" y="6" width="16" height="12" rx="1.6"/>',
    shapeellipse: '<ellipse cx="12" cy="12" rx="8.4" ry="6.4"/>',
    shapeline: '<path d="M4.6 19.4 19.4 4.6"/><circle cx="4.6" cy="19.4" r="1.6"/><circle cx="19.4" cy="4.6" r="1.6"/>',
    pen: '<path d="M4 20s.8-3.6 2.4-5.2L16.6 4.6a2.4 2.4 0 0 1 3.4 3.4L9.8 18.2C8.2 19.8 4 20 4 20Z"/><path d="m15 6.2 3.4 3.4"/>',
    text: '<path d="M5 6.4V4.6h14v1.8"/><path d="M12 4.6v14.8"/><path d="M9 19.4h6"/>',
    eraser: '<path d="m9.4 19.4-4.8-4.8a1.8 1.8 0 0 1 0-2.6l8-8a1.8 1.8 0 0 1 2.6 0l4.2 4.2a1.8 1.8 0 0 1 0 2.6l-8.6 8.6z"/><path d="M9.4 19.4H20M8 8.6l6.4 6.4"/>',
    bucket: '<path d="M6 10.4 12.6 3.8l7.2 7.2-6.6 6.6a1.8 1.8 0 0 1-2.6 0L6 13a1.8 1.8 0 0 1 0-2.6Z"/><path d="M4 8.6 8.8 13.4"/><path d="M20 15.4s2 2.6 2 4a2 2 0 0 1-4 0c0-1.4 2-4 2-4Z" fill="currentColor" stroke="none"/>',
    dropper: '<path d="m14.6 4.8 4.6 4.6"/><path d="M17.8 3.4a2.4 2.4 0 0 1 3.4 3.4l-2 2-3.4-3.4z"/><path d="m14.4 7.4 2.2 2.2-8 8L4.4 19l1.4-4.2z"/>',

    // Orion Music transport
    pause: '<rect x="6.6" y="5" width="3.8" height="14" rx="1.3" fill="currentColor" stroke="none"/><rect x="13.6" y="5" width="3.8" height="14" rx="1.3" fill="currentColor" stroke="none"/>',
    playfill: '<path d="M7.5 4.8v14.4L19.6 12z" fill="currentColor" stroke="none"/>',
    next: '<path d="M5.6 5.4v13.2L15.4 12z" fill="currentColor" stroke="none"/><rect x="16.8" y="5.4" width="2.6" height="13.2" rx="1.2" fill="currentColor" stroke="none"/>',
    prev: '<path d="M18.4 5.4v13.2L8.6 12z" fill="currentColor" stroke="none"/><rect x="4.6" y="5.4" width="2.6" height="13.2" rx="1.2" fill="currentColor" stroke="none"/>',
    shuffle: '<path d="M3.6 6.6h3.2c1.9 0 3 1.1 4.2 2.7l2.6 3.6c1.2 1.6 2.3 2.5 4.2 2.5h2.6"/><path d="M17.6 3.8 20.8 6.6l-3.2 2.8M17.6 12.6l3.2 2.8-3.2 2.8"/><path d="M3.6 17.4h3.2c1.6 0 2.6-.8 3.6-2"/>',
    repeat: '<path d="M6.4 8.2h11a3 3 0 0 1 3 3v.6"/><path d="M17.6 16.8h-11a3 3 0 0 1-3-3v-.6"/><path d="m8.8 5.4-2.8 2.8 2.8 2.8M15.2 13.6l2.8 3.2-2.8 2.8"/>',
    repeatone: '<path d="M6.4 8.2h11a3 3 0 0 1 3 3v.6"/><path d="M17.6 16.8h-11a3 3 0 0 1-3-3v-.6"/><path d="m8.8 5.4-2.8 2.8 2.8 2.8M15.2 13.6l2.8 3.2-2.8 2.8"/><path d="M11.4 10.6 12.8 9.6v5" stroke-width="1.5"/>',
    queue: '<path d="M4 6.6h11M4 11h11M4 15.4h7"/><path d="M17.6 9.6v8.2" /><circle cx="15.6" cy="18" r="2" fill="currentColor" stroke="none"/><path d="M17.6 9.6 21 8.4v2.4l-3.4 1.2z" fill="currentColor" stroke="none"/>',
    heart: '<path d="M12 20.2 4.9 13a4.4 4.4 0 0 1 6.2-6.2l.9.9.9-.9A4.4 4.4 0 0 1 19.1 13z"/>',
    heartfill: '<path d="M12 20.2 4.9 13a4.4 4.4 0 0 1 6.2-6.2l.9.9.9-.9A4.4 4.4 0 0 1 19.1 13z" fill="currentColor"/>',
    note: '<path d="M9 18V5.4l10-2v12.2"/><ellipse cx="6.6" cy="18" rx="2.6" ry="2.2"/><ellipse cx="16.6" cy="15.6" rx="2.6" ry="2.2"/>',
    disc: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="2.4"/><path d="M12 3.4a8.6 8.6 0 0 1 0 17.2" opacity=".5"/>',
    explore: '<circle cx="12" cy="12" r="8.6"/><path d="m15.4 8.6-1.8 5.2-5.2 1.8 1.8-5.2z" fill="currentColor" stroke="none"/>',
    library: '<rect x="3.4" y="5" width="4" height="14" rx="1.2"/><rect x="9.6" y="5" width="4" height="14" rx="1.2"/><path d="m16.4 6.4 3.6 1-3 12-3.6-1z"/>'
  };

  // Filled / colored app icons (32x32) ------------------------------------
  var A = {
    edge: '<defs><linearGradient id="edg1" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#0a5cb8"/><stop offset=".5" stop-color="#0f8cd8"/><stop offset="1" stop-color="#3ddcd6"/></linearGradient><linearGradient id="edg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#35c1f1"/><stop offset="1" stop-color="#0b64c9"/></linearGradient></defs>'
      + '<path d="M28.7 21.6c-1.5 3.9-5.1 7.3-10.6 7.3-7 0-12.6-5.1-12.6-11.9 0-3 1.3-5.6 2.8-7-2 1.3-3.3 3.4-3.3 6 0 4 3.4 6.6 8 6.6 3.6 0 6.4-1 8.6-1 4.1 0 6.5 2 7.1 3.2z" fill="url(#edg2)"/>'
      + '<path d="M16.1 2.4c7.3 0 12.4 5 13.5 11.3.4 2.4-.2 4.2-2 4.2-6.6 0-3.9-6.6-12-6.6-4.8 0-8.6 3.4-9.6 8-.2-1-.3-1.9-.3-2.9C5.7 8.9 10.4 2.4 16.1 2.4z" fill="url(#edg1)"/>'
      + '<path d="M8.2 9.9C10.5 5.6 15 2.7 20.1 2.7c1.2 0 2.4.2 3.5.5-6.1-.6-11.6 3-13.3 8.6-1.4 4.6.4 9.3 4.2 11.9-4.3-.6-7.6-4.3-7.6-8.8 0-1.8.5-3.5 1.3-5z" fill="#3fd2e8" opacity=".55"/>',
    explorer: '<defs><linearGradient id="exg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd77a"/><stop offset="1" stop-color="#f5b433"/></linearGradient></defs>'
      + '<path d="M3 8.2A2.2 2.2 0 0 1 5.2 6h7.1l3 3.4h11.5a2.2 2.2 0 0 1 2.2 2.2v2H3z" fill="#e0a021"/>'
      + '<path d="M3 12.4h26v11.4A2.2 2.2 0 0 1 26.8 26H5.2A2.2 2.2 0 0 1 3 23.8z" fill="url(#exg)"/>'
      + '<path d="M3 12.4h26v2.2H3z" fill="#fff" opacity=".35"/>',
    notepad: '<defs><linearGradient id="npg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e6edf5"/></linearGradient></defs>'
      + '<path d="M6 4h13l7 7v17H6z" fill="url(#npg)" stroke="#c3cfdb"/>'
      + '<path d="M19 4v7h7z" fill="#c3cfdb"/>'
      + '<g stroke="#4a90d9" stroke-width="1.6" stroke-linecap="round"><path d="M10 15h12M10 19h12M10 23h8"/></g>',
    settings: '<defs><linearGradient id="sgA" x1="0" y1="0" x2="1" y2="1">'
      + '<stop offset="0" stop-color="#c3ccd6"/><stop offset="1" stop-color="#7c8b9b"/></linearGradient></defs>'
      + '<path d="M13.4 3h5.2l.7 3.4 2.6 1.5 3.3-1.1 2.6 4.5-2.6 2.3v3l2.6 2.3-2.6 4.5-3.3-1.1-2.6 1.5-.7 3.4h-5.2l-.7-3.4-2.6-1.5-3.3 1.1-2.6-4.5 2.6-2.3v-3L4.5 11.3l2.6-4.5 3.3 1.1 2.6-1.5z" fill="url(#sgA)"/>'
      + '<circle cx="16" cy="16" r="5.4" fill="#222b35"/><circle cx="16" cy="16" r="2.9" fill="#aebccb"/>',

    calculator: '<rect x="5" y="3" width="22" height="26" rx="3" fill="#2f3b46"/>'
      + '<rect x="7.6" y="5.6" width="16.8" height="6" rx="1.4" fill="#0f1a24"/>'
      + '<text x="22.4" y="10.4" text-anchor="end" font-size="4.6" fill="#6de7c8" font-family="monospace">1024</text>'
      + '<g fill="#5b6a78"><rect x="7.6" y="13.8" width="4.4" height="3.6" rx="1"/><rect x="13.8" y="13.8" width="4.4" height="3.6" rx="1"/><rect x="20" y="13.8" width="4.4" height="3.6" rx="1"/>'
      + '<rect x="7.6" y="18.8" width="4.4" height="3.6" rx="1"/><rect x="13.8" y="18.8" width="4.4" height="3.6" rx="1"/><rect x="20" y="18.8" width="4.4" height="3.6" rx="1"/>'
      + '<rect x="7.6" y="23.8" width="10.6" height="3.6" rx="1"/></g>'
      + '<rect x="20" y="23.8" width="4.4" height="3.6" rx="1" fill="#0078d4"/>',
    terminal: '<rect x="3" y="5" width="26" height="22" rx="3" fill="#0c0c0c"/>'
      + '<rect x="3" y="5" width="26" height="5" rx="3" fill="#1f1f1f"/>'
      + '<g stroke="#4ec9b0" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="m8 15 3.4 3.2L8 21.4"/><path d="M14 21.6h7"/></g>',
    photos: '<defs><linearGradient id="phg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#37c6f4"/><stop offset="1" stop-color="#7a5cf0"/></linearGradient></defs>'
      + '<rect x="3.4" y="6" width="25.2" height="20" rx="3" fill="url(#phg)"/>'
      + '<circle cx="10.6" cy="12.6" r="2.4" fill="#fff8c4"/>'
      + '<path d="M3.4 22.4 11 15.6l5.4 4.8 4.8-4 7.4 6.6V23a3 3 0 0 1-3 3H6.4a3 3 0 0 1-3-3z" fill="#fff" opacity=".82"/>',
    store: '<defs><linearGradient id="stg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4cc2ff"/><stop offset="1" stop-color="#0067c0"/></linearGradient></defs>'
      + '<path d="M6.4 10h19.2l-1.6 16a2.4 2.4 0 0 1-2.4 2.2H10.4A2.4 2.4 0 0 1 8 26z" fill="url(#stg)"/>'
      + '<path d="M11.6 12.6V9a4.4 4.4 0 0 1 8.8 0v3.6" fill="none" stroke="#cfe9ff" stroke-width="2" stroke-linecap="round"/>',
    taskmgr: '<rect x="3.4" y="5" width="25.2" height="22" rx="3" fill="#1f2c38"/>'
      + '<g fill="#4cc2ff"><rect x="7" y="16" width="3.6" height="7" rx="1"/><rect x="12.6" y="12" width="3.6" height="11" rx="1"/><rect x="18.2" y="8.6" width="3.6" height="14.4" rx="1"/><rect x="23.8" y="14" width="2.6" height="9" rx="1"/></g>'
      + '<path d="M3.4 8h25.2" stroke="#33465a" stroke-width="1.4"/>',
    recycle: '<path d="M8.4 10h15.2l-1.3 16.2a2.2 2.2 0 0 1-2.2 2H11.9a2.2 2.2 0 0 1-2.2-2z" fill="#7d8b99" opacity=".9"/>'
      + '<path d="M6.6 7.6h18.8v2.8H6.6z" fill="#5c6b7a"/><path d="M13 5h6v2.6h-6z" fill="#5c6b7a"/>'
      + '<g fill="none" stroke="#8fe36a" stroke-width="1.8" stroke-linecap="round"><path d="m13.6 15.4-1.8 3 1.8 3"/><path d="M12 18.4h6.6"/></g>',
    thispc: '<rect x="3.4" y="6" width="25.2" height="16" rx="2.4" fill="#3d4c5a"/>'
      + '<rect x="5.6" y="8.2" width="20.8" height="11.6" rx="1.2" fill="#4cc2ff" opacity=".85"/>'
      + '<path d="M11 24.4h10l1.4 3H9.6z" fill="#2f3b46"/>',
    folder: '<path d="M3 8.6A2 2 0 0 1 5 6.6h6.6l2.8 3.2h12.6a2 2 0 0 1 2 2v1.4H3z" fill="#e0a021"/>'
      + '<path d="M3 13.2h26v10.6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#f5c453"/>',
    file: '<path d="M7 3.4h12l6 6v19H7z" fill="#f2f5f8" stroke="#c3cfdb"/><path d="M19 3.4v6h6z" fill="#c3cfdb"/>',
    filetext: '<path d="M7 3.4h12l6 6v19H7z" fill="#f2f5f8" stroke="#c3cfdb"/><path d="M19 3.4v6h6z" fill="#c3cfdb"/>'
      + '<g stroke="#8a9aa8" stroke-width="1.4" stroke-linecap="round"><path d="M11 14h10M11 18h10M11 22h6"/></g>',
    fileimg: '<path d="M7 3.4h12l6 6v19H7z" fill="#f2f5f8" stroke="#c3cfdb"/><path d="M19 3.4v6h6z" fill="#c3cfdb"/>'
      + '<circle cx="12.6" cy="15" r="1.8" fill="#f0b429"/><path d="m9 24 4.6-5 3.2 3 2.6-2.2 3.6 4.2z" fill="#4aa3e8"/>',
    drive: '<rect x="3.4" y="9" width="25.2" height="14" rx="2.6" fill="#5a6a78"/>'
      + '<rect x="3.4" y="9" width="25.2" height="7" rx="2.6" fill="#7c8b99"/>'
      + '<circle cx="24" cy="19.4" r="1.6" fill="#8fe36a"/>',
    docs: '<path d="M4.6 7.4A2 2 0 0 1 6.6 5.4h6l2.4 2.8h10.4a2 2 0 0 1 2 2v13.4a2 2 0 0 1-2 2H6.6a2 2 0 0 1-2-2z" fill="#4c8fd6"/>'
      + '<path d="M11 13.6h10v9H11z" fill="#eaf2fb"/><g stroke="#4c8fd6" stroke-width="1.2"><path d="M13 16.4h6M13 19h6"/></g>',

    orion: '<defs>'
      + '<linearGradient id="oR" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#12102e"/><stop offset=".35" stop-color="#4c1d95"/><stop offset=".7" stop-color="#2563eb"/><stop offset="1" stop-color="#22a7ff"/></linearGradient>'
      + '<linearGradient id="oRL" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#12102e"/><stop offset=".55" stop-color="#3b1f9e"/><stop offset="1" stop-color="#6d3bf5"/></linearGradient>'
      + '<linearGradient id="oS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4c1d95"/><stop offset=".45" stop-color="#3b5cf6"/><stop offset="1" stop-color="#22a7ff"/></linearGradient></defs>'
      + '<g transform="scale(0.32)">'
      + '<path d="M36.5 15.4A38 38 0 0 0 36.5 84.6" fill="none" stroke="url(#oRL)" stroke-width="9.5" stroke-linecap="round"/>'
      + '<path d="M63.5 15.4A38 38 0 0 1 63.5 84.6" fill="none" stroke="url(#oR)" stroke-width="9.5" stroke-linecap="round"/>'
      + '<path d="M50 2C52.4 26 57 40.5 71 45.4C81 48.9 88 49.4 98 50C88 50.6 81 51.1 71 54.6C57 59.5 52.4 74 50 98C47.6 74 43 59.5 29 54.6C19 51.1 12 50.6 2 50C12 49.4 19 48.9 29 45.4C43 40.5 47.6 26 50 2 Z" fill="url(#oS)"/>'
      + '</g>',

    orionstore: '<defs>'
      + '<linearGradient id="obA" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#1b1650"/><stop offset=".55" stop-color="#4c2ba0"/><stop offset="1" stop-color="#9d4bf0"/></linearGradient>'
      + '<linearGradient id="obB" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs>'
      + '<path d="M11.5 11V9.2a4.5 4.5 0 0 1 9 0V11" fill="none" stroke="#8b5cf6" stroke-width="2.6" stroke-linecap="round"/>'
      + '<path d="M7.6 10.4h16.8a2.6 2.6 0 0 1 2.6 2.9l-1.5 12.4a3 3 0 0 1-3 2.6H9.5a3 3 0 0 1-3-2.6L5 13.3a2.6 2.6 0 0 1 2.6-2.9Z" fill="url(#obA)"/>'
      + '<path d="M16 13.4c1.2 5.2 2.4 6.4 7.2 7.4-4.8 1-6 2.2-7.2 7.4-1.2-5.2-2.4-6.4-7.2-7.4 4.8-1 6-2.2 7.2-7.4Z" fill="#fff"/>'
      + '<ellipse cx="16" cy="19" rx="14.5" ry="5.6" fill="none" stroke="url(#obB)" stroke-width="2.2" transform="rotate(-20 16 19)" opacity=".95"/>',

    youtube: '<rect x="2" y="6" width="28" height="20" rx="5.5" fill="#e23b2e"/>'
      + '<path d="M13.4 11.6 21.4 16l-8 4.4z" fill="#fff"/>',

    vpn: '<defs><linearGradient id="vpg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#0e7490"/></linearGradient></defs>'
      + '<path d="M16 3.2 5.6 7.2v8.2c0 6.4 4.4 10.9 10.4 13.4 6-2.5 10.4-7 10.4-13.4V7.2z" fill="url(#vpg)"/>'
      + '<path d="m10.8 16.2 3.6 3.6 7-7.2" fill="none" stroke="#eafff6" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    mine: '<circle cx="16" cy="17" r="9" fill="#37414d"/><path d="M16 3v5M16 26v3M3 17h5M24 17h5M7.2 8.2l3.6 3.6M21.2 22.2l3.6 3.6M24.8 8.2l-3.6 3.6M10.8 22.2l-3.6 3.6" stroke="#37414d" stroke-width="2.4" stroke-linecap="round"/>'
      + '<circle cx="12.6" cy="13.6" r="2.2" fill="#8fa3b8"/>',
    cards: '<rect x="4" y="7" width="14" height="19" rx="2.2" fill="#f4f7fb" stroke="#c3cfdb" transform="rotate(-10 11 16)"/>'
      + '<rect x="13" y="6" width="15" height="20" rx="2.2" fill="#fff" stroke="#c3cfdb"/>'
      + '<path d="M20.5 10.5 24 15l-3.5 4.5L17 15z" fill="#d13b3b"/>',
    tiles: '<rect x="3.4" y="3.4" width="25.2" height="25.2" rx="3.4" fill="#bbada0"/>'
      + '<g fill="#eee4da"><rect x="6" y="6" width="8.6" height="8.6" rx="1.6"/><rect x="17.4" y="17.4" width="8.6" height="8.6" rx="1.6"/></g>'
      + '<rect x="17.4" y="6" width="8.6" height="8.6" rx="1.6" fill="#f2b179"/>'
      + '<rect x="6" y="17.4" width="8.6" height="8.6" rx="1.6" fill="#edc22e"/>',
    snake: '<rect x="3" y="3" width="26" height="26" rx="4" fill="#12321c"/>'
      + '<g fill="#4ade80"><rect x="7" y="12" width="5" height="5" rx="1.4"/><rect x="12.5" y="12" width="5" height="5" rx="1.4"/><rect x="18" y="12" width="5" height="5" rx="1.4"/><rect x="18" y="17.5" width="5" height="5" rx="1.4"/></g>'
      + '<circle cx="10" cy="22" r="2.6" fill="#f87171"/>',
    blocks: '<rect x="3" y="3" width="26" height="26" rx="4" fill="#141a2e"/>'
      + '<g><rect x="7" y="7" width="6" height="6" rx="1" fill="#22d3ee"/><rect x="13.5" y="7" width="6" height="6" rx="1" fill="#22d3ee"/>'
      + '<rect x="13.5" y="13.5" width="6" height="6" rx="1" fill="#a855f7"/><rect x="20" y="13.5" width="6" height="6" rx="1" fill="#a855f7"/>'
      + '<rect x="7" y="20" width="6" height="6" rx="1" fill="#f59e0b"/><rect x="13.5" y="20" width="6" height="6" rx="1" fill="#f59e0b"/></g>',
    pong: '<rect x="3" y="5" width="26" height="22" rx="3" fill="#0b0f16"/>'
      + '<path d="M16 6v20" stroke="#33465a" stroke-width="1.6" stroke-dasharray="2 3"/>'
      + '<rect x="5.6" y="10" width="2.8" height="9" rx="1.4" fill="#e2e8f0"/>'
      + '<rect x="23.6" y="13" width="2.8" height="9" rx="1.4" fill="#e2e8f0"/>'
      + '<circle cx="17.4" cy="15" r="2.2" fill="#4ade80"/>',

    // Orion Office and Orion Creative --------------------------------------
    write: '<rect x="4" y="2.6" width="24" height="26.8" rx="3" fill="#f8fafc"/>'
      + '<rect x="4" y="2.6" width="7" height="26.8" rx="3" fill="#2b579a"/>'
      + '<path d="M13.4 9.6h11M13.4 14h11M13.4 18.4h11M13.4 22.8h7.4" stroke="#93a4bd" stroke-width="1.8" stroke-linecap="round"/>'
      + '<path d="M6 11.4 7.6 21l1.2-6 1.2 6L11.6 11.4" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>',
    sheets: '<rect x="4" y="2.6" width="24" height="26.8" rx="3" fill="#f8fafc"/>'
      + '<rect x="4" y="2.6" width="24" height="6.4" rx="3" fill="#1d7a4c"/>'
      + '<rect x="4" y="6" width="24" height="3" fill="#1d7a4c"/>'
      + '<path d="M12 9v20.4M20 9v20.4M4 15.6h24M4 22.2h24" stroke="#c9d6e3" stroke-width="1.4"/>'
      + '<rect x="20" y="15.6" width="8" height="6.6" fill="#34d399" opacity=".5"/>',
    slides: '<rect x="4" y="2.6" width="24" height="26.8" rx="3" fill="#f8fafc"/>'
      + '<rect x="4" y="2.6" width="24" height="6.4" rx="3" fill="#c0492b"/>'
      + '<rect x="4" y="6" width="24" height="3" fill="#c0492b"/>'
      + '<rect x="7.6" y="12.4" width="16.8" height="10.6" rx="1.4" fill="#fde3d6" stroke="#e58f6f" stroke-width="1.2"/>'
      + '<path d="M10.6 20.4 14 16.4l2.6 3 2.4-2.6 2.4 3.6z" fill="#c0492b"/>'
      + '<path d="M10.6 25.8h10.8" stroke="#b8c4d2" stroke-width="1.6" stroke-linecap="round"/>',
    notes: '<rect x="5" y="2.6" width="22" height="26.8" rx="3" fill="#f8fafc"/>'
      + '<rect x="5" y="2.6" width="22" height="26.8" rx="3" fill="none" stroke="#dbe3ec" stroke-width="1.2"/>'
      + '<rect x="20.4" y="2.6" width="6.6" height="26.8" rx="3" fill="#7b2fb5"/>'
      + '<path d="M9.4 9.6h8.4M9.4 14h8.4M9.4 18.4h8.4M9.4 22.8h5" stroke="#a9b6c7" stroke-width="1.8" stroke-linecap="round"/>'
      + '<path d="M22.4 8.6h2.6M22.4 15h2.6M22.4 21.4h2.6" stroke="#e7d6f5" stroke-width="1.8" stroke-linecap="round"/>',
    draw: '<rect x="3" y="3" width="26" height="26" rx="4" fill="#160f2e"/>'
      + '<path d="M8 23.6s.6-4 2.2-5.6L20 8.2a2.6 2.6 0 0 1 3.8 3.6L14 21.6c-1.6 1.6-6 2-6 2Z" fill="#f59e0b"/>'
      + '<path d="m18.4 9.8 3.8 3.8" stroke="#160f2e" stroke-width="1.6"/>'
      + '<circle cx="10.4" cy="10.4" r="3" fill="none" stroke="#22d3ee" stroke-width="1.8"/>'
      + '<rect x="18.6" y="19.4" width="6.4" height="6.4" rx="1.4" fill="none" stroke="#a855f7" stroke-width="1.8"/>',
    // A star with an orbit rising out of an open book - Chase's own mark.
    orionlearn: '<defs>'
      + '<linearGradient id="olA" x1="0" y1="0" x2="1" y2="1">'
      + '<stop offset="0" stop-color="#4f86f7"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient>'
      + '<linearGradient id="olB" x1="0" y1="0" x2="1" y2="0">'
      + '<stop offset="0" stop-color="#4f86f7"/><stop offset="100%" stop-color="#9b7cf6"/></linearGradient>'
      + '</defs>'
      // open book
      + '<path d="M2.9 23.1c3.9-1.5 8.2-1.4 12.3 1.2v4.6c-4.1-2.6-8.4-2.7-12.3-1.2z" fill="url(#olB)"/>'
      + '<path d="M29.1 23.1c-3.9-1.5-8.2-1.4-12.3 1.2v4.6c4.1-2.6 8.4-2.7 12.3-1.2z" fill="url(#olB)"/>'
      + '<path d="M5.1 20.6c3.3-1.1 6.9-.9 10.1 1.3v2.1c-3.2-2.2-6.8-2.4-10.1-1.3z" fill="#c9d4fb"/>'
      + '<path d="M26.9 20.6c-3.3-1.1-6.9-.9-10.1 1.3v2.1c3.2-2.2 6.8-2.4 10.1-1.3z" fill="#d8cffb"/>'
      // four point star
      + '<path d="M16 3.4c.7 6.6 1.9 8.9 5.9 10.1-4 1.2-5.2 3.5-5.9 10.1-.7-6.6-1.9-8.9-5.9-10.1 4-1.2 5.2-3.5 5.9-10.1Z" fill="url(#olA)"/>'
      // orbit ring and its moon
      + '<ellipse cx="16" cy="13.5" rx="10.4" ry="4.1" fill="none" stroke="url(#olB)" '
      + 'stroke-width="1.5" transform="rotate(-19 16 13.5)"/>'
      + '<circle cx="24.4" cy="8.6" r="2.1" fill="#4f86f7"/>'
      // small sparkle
      + '<path d="M9.2 5.6c.3 2.1.6 2.5 2.2 3-1.6.5-1.9.9-2.2 3-.3-2.1-.6-2.5-2.2-3 1.6-.5 1.9-.9 2.2-3Z" fill="#8b9cf7"/>',
    orionmusic: '<defs><linearGradient id="omG" x1="0" y1="0" x2="1" y2="1">'
      + '<stop offset="0" stop-color="#ff2d55"/><stop offset="100%" stop-color="#b0154a"/></linearGradient></defs>'
      + '<circle cx="16" cy="16" r="13.4" fill="url(#omG)"/>'
      + '<circle cx="16" cy="16" r="13.4" fill="none" stroke="#ffffff" stroke-opacity=".22" stroke-width="1"/>'
      + '<path d="M13.4 21.4V11.2l8.2-1.7v9.1" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<ellipse cx="11.7" cy="21.6" rx="2.5" ry="2.1" fill="#fff"/>'
      + '<ellipse cx="19.9" cy="19.8" rx="2.5" ry="2.1" fill="#fff"/>',
    photo: '<rect x="3" y="3" width="26" height="26" rx="4" fill="#0d1b2f"/>'
      + '<circle cx="16" cy="16" r="9.4" fill="none" stroke="#31c5f4" stroke-width="1.6"/>'
      + '<path d="M16 6.6a9.4 9.4 0 0 1 0 18.8z" fill="#31c5f4" opacity=".85"/>'
      + '<circle cx="16" cy="16" r="3.6" fill="#0d1b2f"/>'
      + '<circle cx="22.4" cy="9.6" r="1.6" fill="#fbbf24"/>'
  };

  function wrap(inner, vb, extra) {
    return '<svg viewBox="' + vb + '" xmlns="http://www.w3.org/2000/svg" ' + (extra || '') + '>' + inner + '</svg>';
  }

  /**
   * Gradient ids are written once in the table but drawn many times on the
   * page - the Store icon appears on the taskbar, the desktop, in Start and in
   * Settings all at once. Every copy carried the SAME id, and url(#id) binds to
   * whichever one is first in the document, so as soon as a re-render removed
   * that copy the rest lost their fill and went flat. Stamping each render with
   * its own suffix keeps every instance self-contained.
   */
  var idSeq = 0;
  function uniqueIds(markup) {
    if (markup.indexOf('id="') < 0) return markup;
    var tag = '_i' + (++idSeq).toString(36);
    return markup
      .replace(/id="([^"]+)"/g, function (_, id) { return 'id="' + id + tag + '"'; })
      .replace(/url\(#([^)"]+)\)/g, function (_, id) { return 'url(#' + id + tag + ')'; });
  }

  var Icons = {
    /** Returns SVG markup for a named icon. */
    get: function (name) {
      // An uploaded logo is wrapped in the same <svg> box a built-in icon
      // uses, so every "… svg { width: N }" rule in the stylesheets sizes it
      // too. Returning a bare <img> left it unsized wherever the CSS targeted
      // svg specifically, which is why custom logos came out the wrong size.
      if (typeof name === 'string' && name.slice(0, 5) === 'data:') {
        var href = name.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        return wrap('<image href="' + href + '" xlink:href="' + href + '" ' +
          'x="0" y="0" width="32" height="32" preserveAspectRatio="xMidYMid meet"/>',
          '0 0 32 32', 'xmlns:xlink="http://www.w3.org/1999/xlink"');
      }
      if (A[name]) return wrap(uniqueIds(A[name]), '0 0 32 32');
      if (S[name]) {
        return wrap(S[name], '0 0 24 24',
          'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"');
      }
      return wrap('<rect x="4" y="4" width="16" height="16" rx="3"/>', '0 0 24 24',
        'fill="none" stroke="currentColor" stroke-width="1.6"');
    },
    /** The Orion mark, used for the Start button. */
    start: function () { return Icons.get('orion'); },
    has: function (name) { return !!(A[name] || S[name]); },

    /** Register generated artwork (used for installed game tiles). */
    add: function (name, inner) { A[name] = inner; return name; }
  };

  global.Icons = Icons;
})(window);
