import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { EventService } from './event.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventGateway.name);

  constructor(private readonly eventService: EventService) {
    // 이벤트 스트림 구독
    this.eventService.eventStream.subscribe((event) => {
      // 모든 연결된 클라이언트에게 이벤트 브로드캐스트
      this.server.emit('event', event);
    });
  }

  handleConnection(client: Socket) {
    this.logger.log(`클라이언트 연결됨: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`클라이언트 연결 해제됨: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { subscriptionId?: number; chainId?: number },
  ) {
    this.logger.log(`구독 요청: ${JSON.stringify(data)}`);
    // 실시간 이벤트는 이미 브로드캐스트되고 있으므로 여기서는 확인만
    return { status: 'subscribed' };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(@MessageBody() data: { subscriptionId?: number }) {
    this.logger.log(`구독 해제 요청: ${JSON.stringify(data)}`);
    return { status: 'unsubscribed' };
  }
}
