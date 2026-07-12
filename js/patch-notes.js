// Canonical patch-note data for the Latest Update / What's New interface.
//
// This is the single source of truth for the in-game changelog. The raw GitHub
// release categories (Added / Changed / Improved / Fixed / Removed / Technical)
// have been mapped here into the cleaner player-facing groups the UI renders:
// New Features, Gameplay, Cosmetics, Interface, Improvements, Bug Fixes,
// Removed, Technical. Releases are ordered newest -> oldest and must stay that
// way. Maintenance-only metadata (sourceType / confidence) is never shown to
// players.
const PatchNotes = (() => {
  // [key, player-facing label] in the exact display order. Empty groups are
  // skipped by the renderer so no bare headings ever appear.
  const CATEGORY_ORDER = [
    ['newFeatures', 'New Features'],
    ['gameplay', 'Gameplay'],
    ['cosmetics', 'Cosmetics'],
    ['interface', 'Interface'],
    ['improvements', 'Improvements'],
    ['bugFixes', 'Bug Fixes'],
    ['removed', 'Removed'],
    ['technical', 'Technical'],
  ];

  const releases = [
    {
      version: '1.6.2',
      title: 'Controller Navigation & What\u2019s New',
      date: '2026-07-12',
      summary: 'Added an in-game What\u2019s New patch-notes screen and refined controller menu navigation with smoother pacing and device-aware button icons.',
      highlights: [
        'New in-game What\u2019s New patch-notes screen',
        'Smoother, better-paced controller navigation',
        'Device-aware keyboard and controller button icons',
      ],
      categories: {
        newFeatures: [
          'New What\u2019s New / Patch History screen listing every release, opened from the main menu.',
          'Latest Update card on the main menu that shows the newest release, with a NEW badge and glow until you view it.',
        ],
        interface: [
          'Improved controller and keyboard menu navigation, including scrolling long changelog and content panels with the D-pad or stick.',
          'Tuned controller navigation speed so held directions repeat at a consistent, comfortable rate on any display refresh rate.',
          'On-screen button prompts now match your device, swapping between keyboard keys and Xbox or PlayStation controller icons.',
        ],
      },
      sourceType: 'official-release-notes',
      confidence: 'high',
    },
    {
      version: '1.6.1',
      title: 'Crisp Rendering Update',
      date: '2026-07-12',
      summary: 'Improved visual clarity with native-resolution rendering and a new Render Resolution setting.',
      highlights: [
        'Sharper native-resolution rendering',
        'Improved menu and text clarity',
        'New Render Resolution setting',
      ],
      categories: {
        newFeatures: [
          'New Render Resolution graphics setting, with Native as the default and lower options for extra performance.',
        ],
        improvements: [
          'The game now renders at the display\u2019s native pixel resolution for sharper visuals.',
          'Replaced transform-based stage scaling with zoom-based scaling.',
        ],
        bugFixes: [
          'Fixed blurry rendering on displays that did not match the old fixed internal resolution.',
          'Fixed menus and text appearing softened by scaling.',
        ],
      },
      sourceType: 'tag-description',
      confidence: 'high',
    },
    {
      version: '1.6.0',
      title: 'Settings & Display Update',
      date: '2026-07-12',
      summary: 'Added a complete settings system, controller support, input remapping, accessibility options, display scaling, and persistent preferences.',
      categories: {
        newFeatures: [
          'Complete tabbed Settings screen with General, Audio, Graphics, and Controls tabs.',
          'Controller support.',
        ],
        gameplay: [
          'Default jump is now W / Up Arrow (Spacebar removed as a default jump input).',
          'Hold and Toggle behaviour options for sprinting.',
        ],
        interface: [
          'Separate Music and Sound Effects volume controls.',
          'HUD visibility options and UI scaling.',
          'Colorblind display modes.',
          'Keyboard input remapping.',
          'Background-effects controls.',
          'Fullscreen launch behaviour and a minimum window size of 960\u00d7540.',
        ],
        improvements: [
          'Added Particle Effects, FPS Limit, and an FPS counter.',
          'Introduced a fixed 2560\u00d71440 internal resolution with uniform window scaling and letterboxing so UI and HUD are never cut off.',
        ],
        technical: [
          'Added a centralized settings manager so options apply consistently everywhere.',
          'Settings now persist through local storage.',
        ],
      },
      sourceType: 'tag-description',
      confidence: 'high',
    },
    {
      version: '1.5.0',
      title: 'Movement, Achievements & Animated Skins',
      date: '2026-07-10',
      summary: 'A major gameplay and progression update adding bounce pads, crouching, fast drop, animated clothing skins, achievements, and expanded profiles.',
      categories: {
        newFeatures: [
          '16 launch achievements (distance, coins, first death, and collection goals) that award Coins and XP.',
        ],
        gameplay: [
          'Bounce Pads that launch you upward and forward.',
          'Ducking / Crouching \u2014 hold S or Down while grounded to crouch and slide beneath lasers.',
          'Fast Drop \u2014 hold S or Down while airborne to descend faster.',
        ],
        cosmetics: [
          'Animated flowing-cloth skins with tiers from Rare through Mythic.',
          'Clothing and hat zones can display animated gradients and seamless looping effects.',
          'Mythic cloth effects react to your movement speed.',
        ],
        interface: [
          'New profile tabs: Overview, Achievements, and Collection.',
          'Animated achievement-unlock notifications.',
          'An Achievements shortcut on the main menu.',
        ],
        bugFixes: [
          'Profile screen now shows skin-unlock progress correctly.',
        ],
      },
      sourceType: 'official-release-notes',
      confidence: 'high',
    },
    {
      version: '1.4.0',
      title: 'Cosmetic Skin Tiers',
      date: '2026-06-16',
      summary: 'Introduced the cosmetic skin rarity system, animated zone overlays, motion-reactive effects, moving-platform coins, and hazard improvements.',
      categories: {
        cosmetics: [
          'Full cosmetic skin system with four rarity tiers: Rare, Epic, Legendary, and Mythic.',
          'Zone-overlay rendering keeps animated effects inside clothing and hat regions.',
          'Motion-reactive cosmetic effects.',
        ],
        gameplay: [
          'Coins can now appear on moving platforms.',
          'Added a warning telegraph before lasers fire.',
          'Adjusted turret behaviour and balancing.',
        ],
        technical: [
          'Documented the versioned build-and-release workflow.',
        ],
      },
      sourceType: 'tag-comparison',
      confidence: 'high',
    },
    {
      version: '1.3.0',
      title: 'Pause Settings & Gameplay Fixes',
      date: '2026-06-08',
      summary: 'Added pause-menu settings, redesigned turrets, a true Zen Easy mode, limited Extra Revives, and several collision and respawn fixes.',
      categories: {
        interface: [
          'In-game pause menu (opened with Escape) with Music Volume, SFX Volume, and a Particle Effects toggle.',
        ],
        gameplay: [
          'Difficulty can no longer be changed during a run.',
          'Redesigned and repositioned turrets: raised placement, muzzle-fired bullets, firing recoil, and a firing sound.',
          'Easy is now a true Zen mode without deadly traps.',
          'Extra Revives are limited to three per run.',
        ],
        bugFixes: [
          'Darts now check against the player\u2019s full bounding box.',
          'Moving platforms correctly carry players and spikes.',
          'Improved respawn placement so you can no longer respawn in the void.',
        ],
      },
      sourceType: 'official-release-notes',
      confidence: 'high',
    },
    {
      version: '1.2.0',
      title: 'New Hazards & Automatic Updates',
      date: '2026-06-08',
      summary: 'Added multiple platform and hazard types, introduced automatic game updates, and removed homing drones and Daily Challenges.',
      categories: {
        gameplay: [
          'Elevator platforms that move up or down at variable speeds.',
          'Turrets that fire tracking darts.',
          'Conveyor belts.',
          'Laser beams.',
          'Ice platforms.',
        ],
        technical: [
          'Automatic update checking on launch, automatic downloading, and restart-to-install.',
          'A manual Update Game button as a fallback.',
        ],
        removed: [
          'Removed homing drones.',
          'Removed the Daily Challenge feature.',
        ],
        bugFixes: [
          'Fixed elevator-related respawn behaviour.',
        ],
      },
      sourceType: 'official-release-notes',
      confidence: 'high',
    },
    {
      version: '1.1.9',
      title: 'Packaged-Build Security Cleanup',
      date: '2026-06-04',
      summary: 'Disabled developer tools in production builds while keeping them available during development.',
      categories: {
        technical: [
          'Disabled Developer Tools in packaged production builds (still available during development).',
        ],
      },
      sourceType: 'tag-comparison',
      confidence: 'high',
    },
    {
      version: '1.1.8',
      title: 'Progression, Consumables & Menu Expansion',
      date: '2026-06-04',
      summary: 'A large early update expanding progression, profiles, difficulty, consumables, visual customization, music, and menu presentation.',
      categories: {
        gameplay: [
          'Extra Revive and Coin Doubler / Booster (5\u00d7) consumables.',
          'Difficulty scaling with a death penalty on Hard mode.',
          'Adjusted coin density.',
        ],
        cosmetics: [
          'Cosmetic trail effects.',
          'You can now unequip cosmetic buffs.',
        ],
        interface: [
          'Dedicated Profile screen with playtime tracking and scrolling for long names.',
          'A character preview and quick-customization panel on the main menu.',
          'Themed confirmation dialogs for Prestige and profile deletion.',
          'Improved Game Over panel.',
        ],
        improvements: [
          'Music now evolves during gameplay.',
        ],
        bugFixes: [
          'Fixed trail particles appearing while idle.',
          'Fixed the profile-list scrollbar.',
          'Fixed menu layout issues and logo clipping.',
        ],
      },
      sourceType: 'tag-comparison',
      confidence: 'high',
    },
    {
      version: '1.1.7',
      title: 'Shop Item Previews',
      date: '2026-06-04',
      summary: 'Added live character previews for hats and clothing in the shop.',
      categories: {
        cosmetics: [
          'Live character previews for every hat and clothing item in the shop, so you can see cosmetics before buying or equipping.',
        ],
      },
      sourceType: 'tag-comparison',
      confidence: 'high',
    },
    {
      version: '1.1.6',
      title: 'Cosmetics & Level Progression',
      date: '2026-06-04',
      summary: 'Introduced the cosmetic shop, hats, clothing, cosmetic buffs, player levels, XP, and Prestige.',
      categories: {
        newFeatures: [
          'Player level system with XP progression and Prestige.',
        ],
        cosmetics: [
          'A cosmetic shop with hats and clothing.',
          'Gameplay buffs tied to certain hats.',
        ],
      },
      sourceType: 'tag-comparison',
      confidence: 'high',
    },
    {
      version: '1.1.5',
      title: 'Reliable Profile Saving',
      date: '2026-06-04',
      summary: 'Fixed profile data unexpectedly resetting and improved save reliability in the desktop build.',
      categories: {
        bugFixes: [
          'Fixed player profiles unexpectedly resetting.',
          'Profile data now persists to a file in Electron\u2019s user-data directory.',
        ],
        technical: [
          'Added a single-instance lock so multiple running copies can\u2019t interfere with saved data.',
        ],
      },
      sourceType: 'tag-comparison',
      confidence: 'high',
    },
    {
      version: '1.1.4',
      title: 'Background Stability Fix',
      date: '2026-06-04',
      summary: 'Fixed unstable mountain rendering in the scrolling background.',
      categories: {
        bugFixes: [
          'Fixed background mountains shimmering or shaking while the world moved, by indexing peaks to a stable world position.',
        ],
      },
      sourceType: 'tag-comparison',
      confidence: 'high',
    },
    {
      version: '1.1.3',
      title: 'Improved Coin Arcs',
      date: '2026-06-04',
      summary: 'Made coin arcs easier and more natural to collect during normal movement.',
      categories: {
        gameplay: [
          'Lowered coin arcs closer to running height so the first coin can be collected while running instead of jumping.',
        ],
      },
      sourceType: 'tag-comparison',
      confidence: 'high',
    },
    {
      version: '1.1.2',
      title: 'Ground-Level Coin Rows',
      date: '2026-06-04',
      summary: 'Added occasional coin rows that can be collected without jumping.',
      categories: {
        gameplay: [
          'Occasional ground-level coin rows (about a 10% chance) that can be collected without jumping.',
        ],
      },
      sourceType: 'tag-comparison',
      confidence: 'high',
    },
    {
      version: '1.1.1',
      title: 'Release Automation & Game Icon',
      date: '2026-06-04',
      summary: 'Added the custom Platform Racer application icon and automated the release and publishing workflow.',
      categories: {
        newFeatures: [
          'A custom neon Platform Racer application icon, applied to the game window, installer, and favicon.',
        ],
        technical: [
          'One-command release automation \u2014 build, publish, remove draft status, and push \u2014 via a new release script.',
        ],
      },
      sourceType: 'tag-comparison',
      confidence: 'high',
    },
    {
      version: '1.1.0',
      title: 'Profiles, Shop & Desktop Release',
      date: '2026-06-04',
      summary: 'The initial downloadable desktop release in this patch history, featuring profiles, a shop, audio, and the Electron application.',
      categories: {
        newFeatures: [
          'Player profiles.',
          'The in-game shop.',
          'Game audio.',
          'The Electron desktop application \u2014 the first downloadable Platform Racer release.',
        ],
      },
      sourceType: 'initial-release-title',
      confidence: 'partial',
    },
  ];

  function find(version) {
    return releases.find((r) => r.version === version) || null;
  }
  function latest() {
    return releases[0];
  }

  return { releases, CATEGORY_ORDER, find, latest };
})();
