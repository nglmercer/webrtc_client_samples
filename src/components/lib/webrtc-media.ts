// webrtc.ts

// TS-NOTE: Usamos el tipo estándar RTCConfiguration para mayor claridad y compatibilidad.
const ICE_SERVERS: RTCConfiguration = {
    iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
};

// TS-NOTE: Creamos una interfaz para describir la estructura de cada par.
// Esto evita errores y hace el código más legible.
interface PeerData {
    connection: RTCPeerConnection;
    iceQueue: RTCIceCandidate[];
}

// TS-NOTE: Definimos tipos para los callbacks para asegurar que se usen correctamente.
type OnIceCandidateCallback = (peerId: string, candidate: RTCIceCandidate) => void;
type OnStreamCallback = (peerId: string, stream: MediaStream) => void;
type OnConnectionStateChangeCallback = (peerId: string, state: RTCPeerConnectionState) => void;

export class WebRTCManager {
    // TS-NOTE: Tipamos el mapa de pares. La clave es un string (peerId) y el valor es PeerData.
    private peers: Map<string, PeerData> = new Map();
    public localStream: MediaStream | null = null;
    
    // TS-NOTE: Asignamos los tipos de callback a las propiedades de la clase.
    private onIceCandidate: OnIceCandidateCallback;
    private onStream: OnStreamCallback;
    private onConnectionStateChange: OnConnectionStateChangeCallback;

    constructor(
        onIceCandidate: OnIceCandidateCallback,
        onStream: OnStreamCallback,
        onConnectionStateChange: OnConnectionStateChangeCallback
    ) {
        this.onIceCandidate = onIceCandidate;
        this.onStream = onStream;
        this.onConnectionStateChange = onConnectionStateChange;
    }

    public setLocalStream(stream: MediaStream): void {
        this.localStream = stream;
    }

    public async createPeerConnection(peerId: string): Promise<RTCPeerConnection> {
        if (this.peers.has(peerId)) {
            console.warn(`Ya existe una conexión para el par ${peerId}. Cerrando la anterior.`);
            this.closeConnection(peerId);
        }

        const peerConnection = new RTCPeerConnection(ICE_SERVERS);
        const iceQueue: RTCIceCandidate[] = [];
        this.peers.set(peerId, { connection: peerConnection, iceQueue });

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream!); // TS-NOTE: '!' afirma que localStream no es null aquí.
            });
        }

        peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
            if (event.candidate) {
                this.onIceCandidate(peerId, event.candidate);
            }
        };

        peerConnection.ontrack = (event: RTCTrackEvent) => {
            console.log(`¡Stream remoto recibido de ${peerId}!`);
            this.onStream(peerId, event.streams[0]);
        };

        peerConnection.onconnectionstatechange = () => {
            this.onConnectionStateChange(peerId, peerConnection.connectionState);
        };
        
        return peerConnection;
    }

    public async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
        let peer = this.peers.get(peerId);
        if (!peer) {
            // TS-NOTE: `await` asegura que la conexión se cree antes de continuar.
            await this.createPeerConnection(peerId);
            peer = this.peers.get(peerId)!; // TS-NOTE: '!' porque sabemos que acaba de ser creado.
        }
        
        const offer = await peer.connection.createOffer();
        await peer.connection.setLocalDescription(offer);
        return offer;
    }

    public async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
        let peer = this.peers.get(peerId);
        if (!peer) {
            await this.createPeerConnection(peerId);
            peer = this.peers.get(peerId)!;
        }

        // TS-NOTE: No es necesario 'new RTCSessionDescription' con las APIs modernas.
        await peer.connection.setRemoteDescription(offer);
        await this.processIceQueue(peerId);

        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);
        return answer;
    }

    public async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
        const peer = this.peers.get(peerId);
        if (!peer) {
            console.error(`No se encontró conexión para el par ${peerId} al recibir una respuesta.`);
            return;
        }
        await peer.connection.setRemoteDescription(answer);
        await this.processIceQueue(peerId);
    }

    public async addIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
        const peer = this.peers.get(peerId);
        // TS-NOTE: Tipamos 'candidate' como RTCIceCandidateInit, que es lo que suele llegar por señalización.
        const rtcCandidate = new RTCIceCandidate(candidate);

        if (peer && peer.connection.remoteDescription) {
            await peer.connection.addIceCandidate(rtcCandidate);
        } else if (peer) {
            peer.iceQueue.push(rtcCandidate);
            console.log(`Candidato ICE encolado para el par ${peerId}.`);
        } else {
            console.error(`No se encontró conexión para el par ${peerId} al añadir candidato ICE.`);
        }
    }

    private async processIceQueue(peerId: string): Promise<void> {
        const peer = this.peers.get(peerId);
        if (!peer) return;

        while (peer.iceQueue.length > 0) {
            const candidate = peer.iceQueue.shift()!; // TS-NOTE: '!' porque comprobamos length > 0.
            try {
                console.log(`Procesando candidato ICE encolado para ${peerId}...`);
                await peer.connection.addIceCandidate(candidate);
            } catch (error) {
                console.error(`Error al añadir candidato ICE encolado para ${peerId}:`, error);
            }
        }
    }
    
    public toggleMic(isEnabled: boolean): void {
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = isEnabled;
            });
        }
    }

    public toggleCam(isEnabled: boolean): void {
        if (this.localStream) {
            this.localStream.getVideoTracks().forEach(track => {
                track.enabled = isEnabled;
            });
        }
    }

    public closeConnection(peerId: string): void {
        const peer = this.peers.get(peerId);
        if (peer) {
            peer.connection.close();
            this.peers.delete(peerId);
            console.log(`Conexión con ${peerId} cerrada.`);
        }
    }
    
    public closeAllConnections(): void {
        for (const peerId of this.peers.keys()) {
            this.closeConnection(peerId);
        }
    }
}