const PLAYERS_MAP = new Map();

class MpScene extends Phaser.Scene {
  constructor () {
    super();
  }

  //<editor-fold defualtstate="collapsed" desc="preload">
  preload () {
    let assetsPath = 'client/assets/';

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

    this.socket.on(PLAYER_JOIN_EVENT, this.addPlayer.bind(this));
    this.socket.on(PLAYER_SYNC_EVENT, this.syncPlayers.bind(this));
    this.socket.on(PLAYER_UPDATE_EVENT, this.updatePlayer.bind(this));
    this.socket.on(PLAYER_SHOOT_EVENT, this.playerShoot.bind(this));
    this.socket.on(PLAYER_DISCONNECT_EVENT, this.playerDisconnect.bind(this));

    this.add.image(640, 360, 'bg');

    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.mouse = this.input.mousePointer;

    let randomSpawnPos = getRandomPos(
      100,
      100,
      config.width - 100,
      config.height - 100);
    this.localPlayer = new HumanPlayer(
      this,
      randomSpawnPos.x,
      randomSpawnPos.y,
      'player', getRandomElement(this.names));
    this.players = this.physics.add.group();
    this.players.add(this.localPlayer);
    this.localPlayer.setCollideWorldBounds(true);

    this.bullets = this.physics.add.group();
    this.hearts = this.physics.add.group();

    let playerData = {};
    playerData.x = this.localPlayer.x;
    playerData.y = this.localPlayer.y;
    playerData.rotation = this.localPlayer.rotation;
    playerData.name = this.localPlayer.name;
    playerData.isDead = this.localPlayer.isDead;
    playerData.bulletType = this.localPlayer.bulletType;
    playerData.totalXp = this.localPlayer.totalXp;
    playerData.level = this.localPlayer.level;
    this.socket.emit(PLAYER_JOIN_EVENT, playerData);

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

  }

  syncPlayers (players) {
    console.log('syncPlayers ' + JSON.stringify(players));
    for (const [k, v] of Object.entries(players)) {
      this.addPlayer(k, v);
    }
  }

  addPlayer (id, playerData) {
    console.log('new player ' + playerData.name + ' added');
    let newPlayer = new Player(
      this,
      playerData.x,
      playerData.y,
      'player',
      playerData.name);
    newPlayer.isDead = playerData.isDead;
    newPlayer.bulletType = playerData.bulletType;
    newPlayer.totalXp = playerData.totalXp;
    newPlayer.level = playerData.level;
    this.players.add(newPlayer);
    PLAYERS_MAP.set(id, newPlayer);
    console.log(PLAYERS_MAP);
    newPlayer.setCollideWorldBounds(true);
  }

  updatePlayer (id, playerData) {
    let player = PLAYERS_MAP.get(id);
    player.x = playerData.x;
    player.y = playerData.y;
    player.rotation = playerData.rotation;
  }

  playerDisconnect (id) {
    let player = PLAYERS_MAP.get(id);
    player.destroyWhole();
  }

  playerShoot (id, target) {
    let player = PLAYERS_MAP.get(id);
    player.shoot(target);
  }

  update () {
    // moving
    if (this.keyW.isDown) this.localPlayer.setVelocityY(-this.localPlayer.speed);
    if (this.keyS.isDown) this.localPlayer.setVelocityY(this.localPlayer.speed);
    if (this.keyA.isDown) this.localPlayer.setVelocityX(-this.localPlayer.speed);
    if (this.keyD.isDown) this.localPlayer.setVelocityX(this.localPlayer.speed);

    // stop
    if (this.keyW.isUp && this.keyS.isUp) this.localPlayer.setVelocityY(0);
    if (this.keyA.isUp && this.keyD.isUp) this.localPlayer.setVelocityX(0);

    // fire
    if (this.mouse.isDown) {
      this.localPlayer.shoot({ x: this.mouse.x, y: this.mouse.y });
    }

    // localPlayer will rotate according to mouse
    this.localPlayer.setRotation(
      Phaser.Math.Angle.Between(
        this.localPlayer.x,
        this.localPlayer.y,
        this.mouse.x,
        this.mouse.y));

    this.players.children.each(function (player) {
      player.update();
    });

    // update this player's state to other people
    this.socket.emit(
      PLAYER_UPDATE_EVENT,
      {
        x: this.localPlayer.x,
        y: this.localPlayer.y,
        rotation: this.localPlayer.rotation
      });
  }

}