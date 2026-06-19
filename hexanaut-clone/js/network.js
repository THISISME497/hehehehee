export class Network {
  constructor() {
    this.ws = null;
    this.playerId = null;
    this.connected = false;
    this.playerCount = 0;
    this.onState = null;
    this.onWelcome = null;
    this.onPlayers = null;
    this.onJoined = null;
    this.onDisconnected = null;
  }

  connect(name) {
    return new Promise((resolve, reject) => {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${location.host}`;

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.connected = true;
        this.ws.send(JSON.stringify({ type: 'join', name }));
      };

      this.ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        switch (msg.type) {
          case 'welcome':
            this.playerId = msg.playerId;
            this.onWelcome?.(msg.playerId, msg.state);
            resolve({ playerId: msg.playerId, state: msg.state });
            break;
          case 'state':
            this.onState?.(msg.state);
            break;
          case 'players':
            this.playerCount = msg.count;
            this.onPlayers?.(msg.count);
            break;
          case 'joined':
            this.onJoined?.(msg.name, msg.playerId);
            break;
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.onDisconnected?.();
      };

      this.ws.onerror = () => {
        reject(new Error('Could not connect to server'));
      };
    });
  }

  sendDirection(dir) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'dir', dir }));
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }
}
