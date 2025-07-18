// PlayerProfileCard.js
// Stylized player profile cards for Castle Wars

export class PlayerProfileCard {
  constructor(scene) {
    this.scene = scene;
    this.card = null;
    this.createCard();
  }

  createCard() {
    // Main card container
    this.card = document.createElement('div');
    this.card.id = 'player-profile-card';
    this.card.style.position = 'fixed';
    this.card.style.left = '50%';
    this.card.style.top = '50%';
    this.card.style.transform = 'translate(-50%, -50%)';
    this.card.style.display = 'none';
    this.card.style.width = '90%';
    this.card.style.maxWidth = '500px';
    this.card.style.maxHeight = '90vh';
    this.card.style.overflowY = 'auto';
    this.card.style.zIndex = '3500';
    this.card.style.fontFamily = 'Arial, sans-serif';
    
    document.body.appendChild(this.card);
  }

  show(playerData) {
    if (!playerData) return;
    
    const role = playerData.role || 'player';
    const stats = playerData.stats || {};
    
    // Role-based styling
    const roleStyles = {
      owner: {
        background: 'linear-gradient(135deg, #2c1810 0%, #4a2c1a 50%, #2c1810 100%)',
        border: '3px solid #ffd700',
        shadow: '0 0 40px rgba(255,215,0,0.6), inset 0 0 20px rgba(255,215,0,0.3)',
        titleColor: '#ffd700',
        accentColor: '#ffed4b'
      },
      admin: {
        background: 'linear-gradient(135deg, #1a1a3e 0%, #2d2d5e 50%, #1a1a3e 100%)',
        border: '3px solid #9b59b6',
        shadow: '0 0 30px rgba(155,89,182,0.5), inset 0 0 15px rgba(155,89,182,0.2)',
        titleColor: '#9b59b6',
        accentColor: '#b39dc7'
      },
      ash: {
        background: 'linear-gradient(135deg, #3d1d3d 0%, #5e2d5e 50%, #3d1d3d 100%)',
        border: '3px solid #ff69b4',
        shadow: '0 0 30px rgba(255,105,180,0.5), inset 0 0 15px rgba(255,105,180,0.2)',
        titleColor: '#ff69b4',
        accentColor: '#ffb6d9'
      },
      mod: {
        background: 'linear-gradient(135deg, #2a2a3e 0%, #3e3e52 50%, #2a2a3e 100%)',
        border: '3px solid #95a5a6',
        shadow: '0 0 20px rgba(149,165,166,0.4), inset 0 0 10px rgba(149,165,166,0.2)',
        titleColor: '#95a5a6',
        accentColor: '#bdc3c7'
      },
      vip: {
        background: 'linear-gradient(135deg, #2d1b3d 0%, #4a2f5e 50%, #2d1b3d 100%)',
        border: '3px solid #aa96da',
        shadow: '0 0 25px rgba(170,150,218,0.5), inset 0 0 12px rgba(170,150,218,0.2)',
        titleColor: '#aa96da',
        accentColor: '#c7b8e8'
      },
      player: {
        background: 'linear-gradient(135deg, #1a1a2e 0%, #2e2e42 50%, #1a1a2e 100%)',
        border: '3px solid #4ecdc4',
        shadow: '0 0 20px rgba(78,205,196,0.4), inset 0 0 10px rgba(78,205,196,0.2)',
        titleColor: '#4ecdc4',
        accentColor: '#7dd3ce'
      }
    };
    
    const style = roleStyles[role] || roleStyles.player;
    
    // Apply styling
    this.card.style.background = style.background;
    this.card.style.border = style.border;
    this.card.style.borderRadius = '20px';
    this.card.style.boxShadow = style.shadow;
    this.card.style.padding = '20px';
    
    // Build card content
    this.card.innerHTML = `
      <div style="position: relative;">
        <!-- Close button -->
        <button onclick="this.parentElement.parentElement.style.display='none'" 
                style="position: absolute; top: -20px; right: -20px; 
                       background: rgba(255,0,0,0.2); border: 2px solid #ff4444;
                       border-radius: 50%; width: 30px; height: 30px;
                       color: #ff4444; font-size: 16px; cursor: pointer;
                       transition: all 0.3s;">✕</button>
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 25px;">
          <h2 style="color: ${style.titleColor}; margin: 0; font-size: 28px;
                     text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">
            ${this.getRoleSymbol(role)} ${playerData.username.toUpperCase()}
          </h2>
          <div style="color: ${style.accentColor}; font-size: 18px; margin-top: 5px;">
            ${role.charAt(0).toUpperCase() + role.slice(1)}
          </div>
        </div>
        
        <!-- Stats Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
          ${this.createStatBox('⚔️', 'Kills', stats.kills || 0, style.accentColor)}
          ${this.createStatBox('💀', 'Deaths', stats.deaths || 0, style.accentColor)}
          ${this.createStatBox('🎯', 'Headshots', stats.headshots || 0, style.accentColor)}
          ${this.createStatBox('🏹', 'Accuracy', this.getAccuracy(stats), style.accentColor)}
          ${this.createStatBox('💰', 'Gold', playerData.gold || 0, '#ffd700')}
          ${this.createStatBox('🏆', 'K/D Ratio', this.getKDRatio(stats), style.accentColor)}
        </div>
        
        <!-- Advanced Stats -->
        <div style="margin-top: 25px;">
          <div style="background: linear-gradient(90deg, ${style.accentColor}30 0%, transparent 50%, ${style.accentColor}30 100%);
                      padding: 12px; margin-bottom: 20px; border-radius: 10px;">
            <h3 style="color: ${style.titleColor}; margin: 0; font-size: 22px; text-align: center;
                       text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">
              ⚡ Advanced Statistics ⚡
            </h3>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
            ${this.createAdvancedStatItem('⚔️', 'Damage Dealt', stats.damageDealt || 0, style.accentColor, '#ff6b6b')}
            ${this.createAdvancedStatItem('🛡️', 'Damage Taken', stats.damageTaken || 0, style.accentColor, '#4ecdc4')}
            ${this.createAdvancedStatItem('🧱', 'Blocks Placed', stats.blocksPlaced || 0, style.accentColor, '#f7b731')}
            ${this.createAdvancedStatItem('💥', 'Blocks Destroyed', stats.blocksDestroyed || 0, style.accentColor, '#e056fd')}
            ${this.createAdvancedStatItem('🔥', 'Longest Streak', stats.longestKillStreak || 0, style.accentColor, '#ff9ff3')}
            ${this.createAdvancedStatItem('⏱️', 'Play Time', this.formatPlayTime(stats.playTime || 0), style.accentColor, '#48dbfb')}
          </div>
        </div>
        
        <!-- Special Badges for Staff -->
        ${this.getSpecialBadges(role, stats)}
      </div>
    `;
    
    this.card.style.display = 'block';
    
    // Add entrance animation
    this.card.style.animation = 'profileCardIn 0.3s ease-out';
    
    // Add animation styles if not already added
    if (!document.getElementById('profile-card-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'profile-card-styles';
      styleSheet.textContent = `
        @keyframes profileCardIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        
        .stat-box:hover {
          transform: translateY(-2px);
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.3), 0 6px 20px rgba(0,0,0,0.6) !important;
          border-color: rgba(255,255,255,0.3) !important;
        }
        
        .advanced-stat:hover {
          transform: translateX(4px);
          background: linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(40,40,60,0.5) 100%) !important;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.5) !important;
        }
        
        .badge-item:hover {
          transform: scale(1.05);
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.3), 0 6px 20px rgba(255,215,0,0.4) !important;
          border-color: #ffd700 !important;
        }
      `;
      document.head.appendChild(styleSheet);
    }
  }

  createStatBox(icon, label, value, color) {
    return `
      <div style="background: linear-gradient(135deg, rgba(0,0,0,0.5) 0%, rgba(20,20,40,0.4) 100%);
                  padding: 18px; border-radius: 16px;
                  border: 2px solid ${color}40; text-align: center;
                  box-shadow: inset 0 2px 4px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.4);
                  transition: all 0.3s; cursor: default;
                  backdrop-filter: blur(5px);">
        <div style="font-size: 28px; margin-bottom: 8px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">${icon}</div>
        <div style="color: ${color}; font-size: 13px; margin-bottom: 5px; 
                    text-transform: uppercase; letter-spacing: 1px;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.8);">${label}</div>
        <div style="color: #ffffff; font-size: 24px; font-weight: bold;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.8);
                    background: linear-gradient(180deg, #ffffff 0%, ${color} 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;">${value}</div>
      </div>
    `;
  }

  createAdvancedStatItem(icon, label, value, borderColor, iconColor) {
    return `
      <div style="background: linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(30,30,50,0.4) 100%);
                  padding: 12px 16px; border-radius: 12px;
                  border: 1px solid ${borderColor}60;
                  box-shadow: inset 0 1px 3px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.3);
                  display: flex; align-items: center; gap: 12px;
                  transition: all 0.3s; cursor: default;
                  backdrop-filter: blur(3px);">
        <div style="font-size: 22px; color: ${iconColor}; 
                    filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5));">${icon}</div>
        <div style="flex: 1;">
          <div style="color: ${borderColor}; font-size: 12px; 
                      text-transform: uppercase; letter-spacing: 0.5px;
                      opacity: 0.9;">${label}</div>
          <div style="color: #ffffff; font-size: 18px; font-weight: bold;
                      text-shadow: 0 1px 3px rgba(0,0,0,0.8);
                      margin-top: 2px;">${value.toLocaleString()}</div>
        </div>
      </div>
    `;
  }

  getRoleSymbol(role) {
    const symbols = {
      owner: '👑',
      admin: '⚡',
      ash: '🔰',
      mod: '🛡️',
      vip: '💎',
      player: '⚔️'
    };
    return symbols[role] || '⚔️';
  }

  getAccuracy(stats) {
    if (!stats.shotsFired || stats.shotsFired === 0) return '0%';
    const accuracy = (stats.shotsHit / stats.shotsFired) * 100;
    return accuracy.toFixed(1) + '%';
  }

  getKDRatio(stats) {
    if (!stats.deaths || stats.deaths === 0) return stats.kills || 0;
    return (stats.kills / stats.deaths).toFixed(2);
  }

  formatPlayTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  getSpecialBadges(role, stats) {
    if (role === 'player') return '';
    
    const badges = [];
    
    // Role-specific badges
    if (role === 'owner') {
      badges.push({ icon: '🏰', label: 'Server Owner' });
    } else if (role === 'admin') {
      badges.push({ icon: '⚖️', label: 'Administrator' });
    } else if (role === 'ash') {
      badges.push({ icon: '🌟', label: 'Senior Admin' });
    } else if (role === 'mod') {
      badges.push({ icon: '👮', label: 'Moderator' });
    } else if (role === 'vip') {
      badges.push({ icon: '🌟', label: 'VIP Member' });
    }
    
    // Achievement badges
    if (stats.kills >= 100) {
      badges.push({ icon: '💯', label: 'Century Killer' });
    }
    if (stats.longestKillStreak >= 10) {
      badges.push({ icon: '🔥', label: 'Unstoppable' });
    }
    if (this.getKDRatio(stats) >= 3) {
      badges.push({ icon: '😈', label: 'Dominator' });
    }
    
    if (badges.length === 0) return '';
    
    return `
      <div style="margin-top: 25px;">
        <div style="background: linear-gradient(90deg, #ffd70030 0%, transparent 50%, #ffd70030 100%);
                    padding: 10px; margin-bottom: 15px; border-radius: 10px;">
          <h3 style="color: #ffd700; margin: 0; font-size: 20px; text-align: center;
                     text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">
            ✨ Special Badges ✨
          </h3>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;">
          ${badges.map(badge => `
            <div style="background: linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(255,215,0,0.05) 100%);
                        border: 2px solid #ffd70060;
                        padding: 10px 16px; border-radius: 25px; display: flex; align-items: center;
                        gap: 8px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.3), 0 4px 12px rgba(255,215,0,0.2);
                        backdrop-filter: blur(3px); transition: all 0.3s;">
              <span style="font-size: 24px; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5));">${badge.icon}</span>
              <span style="color: #ffd700; font-size: 13px; font-weight: bold;
                         text-shadow: 0 1px 2px rgba(0,0,0,0.8);
                         text-transform: uppercase; letter-spacing: 0.5px;">${badge.label}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  hide() {
    if (this.card) {
      this.card.style.display = 'none';
    }
  }

  destroy() {
    if (this.card) {
      this.card.remove();
      this.card = null;
    }
  }
}