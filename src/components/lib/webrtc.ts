// src/lib/webrtc.ts

interface WebRTCManagerCallbacks {
  onSignalNeeded: (peerId: string, signal: any) => void;
  onDataChannelMessage: (peerId: string, message: string) => void;
  onConnectionStateChange: (peerId: string, state: RTCPeerConnectionState) => void;
}

export class WebRTCManager {
  private peerConnections: Record<string, RTCPeerConnection> = {};
  private dataChannels: Record<string, RTCDataChannel> = {};
  private callbacks: WebRTCManagerCallbacks;
  private iceServers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  constructor(callbacks: WebRTCManagerCallbacks) {
    this.callbacks = callbacks;
  }

  private getPeerConnection(peerId: string): RTCPeerConnection {
    if (!this.peerConnections[peerId]) {
      const pc = new RTCPeerConnection(this.iceServers);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
            this.callbacks.onSignalNeeded(peerId, { candidate: event.candidate.toJSON() });
        }
      };
      
      pc.onconnectionstatechange = () => {
        this.callbacks.onConnectionStateChange(peerId, pc.connectionState);
      };
      
      pc.ondatachannel = (event) => {
        console.log(`Data channel '${event.channel.label}' recibido de ${peerId}`);
        this.setupDataChannel(peerId, event.channel);
      };

      this.peerConnections[peerId] = pc;
    }
    return this.peerConnections[peerId];
  }

  private setupDataChannel(peerId: string, channel: RTCDataChannel) {
    this.dataChannels[peerId] = channel;
    channel.onopen = () => console.log(`Data channel con ${peerId} abierto.`);
    channel.onclose = () => console.log(`Data channel con ${peerId} cerrado.`);
    channel.onmessage = (event) => {
      this.callbacks.onDataChannelMessage(peerId, event.data);
    };
  }

  async createOffer(peerId: string): Promise<void> {
    const pc = this.getPeerConnection(peerId);
    const channel = pc.createDataChannel('chat');
    this.setupDataChannel(peerId, channel);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
     this.callbacks.onSignalNeeded(peerId, offer);
  }

  async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.getPeerConnection(peerId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    this.callbacks.onSignalNeeded(peerId, answer);
  }

  async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peerConnections[peerId];
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async addIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections[peerId];
    if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  public broadcastMessage(message: string) {
      Object.values(this.dataChannels).forEach(channel => {
          if (channel.readyState === 'open') {
              channel.send(message);
          }
      });
  }

  public closeConnection(peerId: string) {
    this.peerConnections[peerId]?.close();
    delete this.peerConnections[peerId];
    delete this.dataChannels[peerId];
  }

  public closeAllConnections() {
    Object.keys(this.peerConnections).forEach(id => this.closeConnection(id));
  }
}