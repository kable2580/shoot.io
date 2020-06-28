class MpSceneAI extends Phaser.Scene {
  constructor () {
    super();
  }

  //<editor-fold defualtstate="collapsed" desc="preload">
  preload () {
    let assetsPath = 'assets/';

    // 載入素材
    this.load.image('bg', assetsPath + 'whitebg.png');
    this.load.image('player', assetsPath + 'green_block.png');
    this.load.image('bullet', assetsPath + 'bullet.png');
    this.load.image('wide_bullet', assetsPath + 'wide_bullet.png');
    this.load.image('bullet', assetsPath + 'wide_bullet.png');
    this.load.image(
      'penetration_bullet',
      assetsPath + 'penetration_bullet.png'
    );
    this.load.image('enemy', assetsPath + 'blue_square.png');
    this.load.image('heart', assetsPath + 'heart.png');
    this.load.image('xp', assetsPath + 'xp.png');
    this.load.text('names', assetsPath + 'first-names.txt');

    this.load.plugin(
      'rexbbcodetextplugin',
      'lib/rexbbcodetextplugin.min.js',
      true
    );
  }

  //</editor-fold>

  create () {
    this.names = this.cache.text.get('names').split('\r\n');

    this.socket = io();

    this.bindEvents();

    this.add.image(640, 360, 'bg');

    let randomSpawnPos = getRandomPos(
      100,
      100,
      config.width - 100,
      config.height - 100);
    this.localPlayer = new LocalAIPlayer(
      this,
      randomSpawnPos.x,
      randomSpawnPos.y,
      'player', getRandomElement(this.names));
    this.players = this.physics.add.group();
    this.players.add(this.localPlayer);
    this.localPlayer.setCollideWorldBounds(true);
    let localPlayerData = this.getLocalPlayerData();
    this.socket.emit(PLAYER_JOIN_EVENT, localPlayerData);

    this.bullets = this.physics.add.group();
    this.hearts = this.physics.add.group();
    this.xpConsumables = this.physics.add.group();

    this.physics.add.overlap(
      this.bullets,
      this.players,
      Bullet.bulletHitPlayer
    );

    this.heartOverlap = this.physics.add.overlap(
      this.localPlayer,
      this.hearts,
      Heart.playerOverlapHeart,
      null,
      this
    );

    this.xpOverlap = this.physics.add.overlap(
      this.localPlayer,
      this.xpConsumables,
      XpConsumable.playerOverlapXp,
      null,
      this
    );

    this.upgradeText = this.add.text(
      config.width / 2,
      (config.height / 10
      ) * 9.5,
      '',
      {
        color: '#ffffff',
        fontSize: 25,
        whiteSpace: { width: 1000 },
        fontStyle: 'Bold',
        align: 'center',
        backgroundColor: '#000000'
      }
    );
    this.upgradeText.originX = 0.5;
    this.upgradeText.depth = 99;

    this.leaderBoard = new LeaderBoard(this);
    this.gameFeed = new GameFeed(this);
  }

  //<editor-fold defualtstate="collapsed" desc="callbacks">

  bindEvents () {
    this.socket.on(PLAYER_JOIN_EVENT, this.addPlayer.bind(this));
    this.socket.on(PLAYER_UPDATE_EVENT, this.updatePlayer.bind(this));
    this.socket.on(PLAYER_SHOOT_EVENT, this.playerShoot.bind(this));
    this.socket.on(PLAYER_DISCONNECT_EVENT, this.playerDisconnect.bind(this));
    this.socket.on(PLAYER_DIE_EVENT, this.playerDie.bind(this));
    this.socket.on(PLAYER_SPAWN_EVENT, this.playerSpawn.bind(this));
    this.socket.on(HEART_SPAWN_EVENT, this.spawnHeart.bind(this));
    this.socket.on(HEART_CONSUME_EVENT, this.removeHeart.bind(this));
    this.socket.on(XP_SPAWN_EVENT, this.spawnXpMultiple.bind(this));
    this.socket.on(XP_CONSUME_EVENT, this.removeXp.bind(this));
    this.socket.on(XP_SPAWN_STATIC_EVENT, this.spawnXpStatic.bind(this));
  }

  addPlayer (id, playerData) {
    console.log('player ' + playerData.name + ' added');
    let newPlayer = new RemotePlayer(
      this,
      playerData.x,
      playerData.y,
      'player',
      playerData.name);
    newPlayer.isDead = playerData.isDead;

    newPlayer.hp = playerData.hp;
    newPlayer.bulletType = playerData.bulletType;
    newPlayer.totalXp = playerData.totalXp;
    newPlayer.level = playerData.level;
    newPlayer.scale = playerData.scale;

    // sync death state
    if (newPlayer.isDead) newPlayer.die();
    else this.players.add(newPlayer);

    PLAYERS_MAP.set(id, newPlayer);
    newPlayer.setCollideWorldBounds(true);
  }

  updatePlayer (id, playerData) {
    // console.log(id + ' ' + JSON.stringify(playerData));
    let player = PLAYERS_MAP.get(id);
    if (player !== undefined) {
      if (playerData.hasOwnProperty('x')) player.x = playerData.x;
      if (playerData.hasOwnProperty('y')) player.y = playerData.y;
      if (playerData.hasOwnProperty('rotation')) player.rotation = playerData.rotation;
      if (playerData.hasOwnProperty('hp')) player.hp = playerData.hp;
      if (playerData.hasOwnProperty('xp')) player.xp = playerData.xp;
      if (playerData.hasOwnProperty('totalXp')) player.totalXp = playerData.totalXp;
      if (playerData.hasOwnProperty('level')) player.level = playerData.level;
      if (playerData.hasOwnProperty('bulletType')) player.bulletType = playerData.bulletType;
      if (playerData.hasOwnProperty('scale')) player.scale = playerData.scale;
    }
  }

  playerDisconnect (id) {
    let player = PLAYERS_MAP.get(id);
    if (player !== undefined)
      player.destroyWhole();
  }

  playerShoot (id, target) {
    let player = PLAYERS_MAP.get(id);
    player.shoot(target);
  }

  playerDie (id) {
    let player = PLAYERS_MAP.get(id);
    console.log(player.name + ' died');
    player.die();
  }

  playerSpawn (id, pos) {
    let player = PLAYERS_MAP.get(id);
    player.spawn(pos.x, pos.y);
  }

  spawnHeart (id, pos) {
    let heart = new Heart(this, pos.x, pos.y, id);
    this.hearts.add(heart);
  }

  removeHeart (heartId) {
    this.hearts.children.each(function (heart) {
      if (heart.id === heartId)
        heart.destroy();
    });
  }

  spawnXpMultiple (xps) {
    for (const [xpId, xpData] of Object.entries(xps))
      this.spawnXp(xpId, xpData.x, xpData.y, xpData.target, xpData.range);
  }

  spawnXp (id, x, y, target, range) {
    let xp = new XpConsumable(this, x, y, target, id, range);
    this.xpConsumables.add(xp);
    xp.run();
  }

  spawnXpStatic (xps) {
    for (const [xpId, xpData] of Object.entries(xps)) {
      let xp = new XpConsumable(
        this,
        xpData.x,
        xpData.y,
        { x: xpData.x, y: xpData.y },
        xpId,
        null);
      this.xpConsumables.add(xp);
    }
  }

  removeXp (xpId) {
    this.xpConsumables.children.each(function (xp) {
      if (xp.id === xpId)
        xp.destroy();
    });
  }

  //</editor-fold>

  update () {
    this.players.children.each(function (player) {
      player.update();
    });

    // for respawn
    if (this.localPlayer.isDead) {
      this.localPlayer.update();
    }

    // update this player's state to other people
    let localPlayerData = {
      x: this.localPlayer.x,
      y: this.localPlayer.y,
      rotation: this.localPlayer.rotation,
      hp: this.localPlayer.hp,
      totalXp: this.localPlayer.totalXp
    };

    // console.log('emit');
    this.socket.emit(
      PLAYER_UPDATE_EVENT,
      localPlayerData);

    // this.leaderBoard.update();
    // this.gameFeed.update();
  }

  getLocalPlayerData () {
    let localPlayerData = {};
    // position data
    localPlayerData.x = this.localPlayer.x;
    localPlayerData.y = this.localPlayer.y;
    localPlayerData.rotation = this.localPlayer.rotation;

    // stat data
    localPlayerData.scale = this.localPlayer.scale;
    localPlayerData.hp = this.localPlayer.hp;
    localPlayerData.xp = this.localPlayer.xp;
    localPlayerData.totalXp = this.localPlayer.totalXp;
    localPlayerData.level = this.localPlayer.level;
    localPlayerData.bulletType = this.localPlayer.bulletType;
    localPlayerData.name = this.localPlayer.name;
    localPlayerData.isDead = this.localPlayer.isDead;
    return localPlayerData;
  }
}