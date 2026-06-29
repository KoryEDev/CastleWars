// Central registration of client feature systems (Track 0 seam).
//
// Importing this file (done once by GameScene) pulls in every feature system so
// it can register itself with the shared systemManager. Feature tracks add an
// import line here instead of editing GameScene.
//
// Example:  import '../audio/AudioSystem.js';  // self-registers on import

// (feature systems are appended below by their tracks)
import './InterpolationSystem.js'; // Track 2: remote entity smoothing
import '../ui/ShopUI.js'; // Track 3: gold shop (press B)
import '../net/handlers/progression.js'; // Track 3: XP/level-up/purchase feedback
import './AbilitySystem.js'; // Track 4: classes & abilities (Q / C)
import './KothSystem.js'; // Track 6: King of the Hill objective
import './ItemSystem.js'; // Track 7: PvE loot rendering + boss banner
import '../ui/SocialUI.js'; // Track 8: clans + friends (press O)
import './AudioSystem.js'; // Track 10: synthesized audio engine (press M to mute)
import './ScoreboardSystem.js'; // Track 11: Tab scoreboard
import '../ui/SettingsUI.js'; // Track 11: settings menu (press K)
import './WeatherSystem.js'; // Track 12: weather effects (rain/snow/fog)
