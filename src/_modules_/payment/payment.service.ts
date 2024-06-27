import { Injectable } from '@nestjs/common';
import { catchError, firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { CompletePaymentDto, CreatePaymentDto } from './payment.dto';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { PaymentType } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(createPaymentDto: CreatePaymentDto) {
    const { userId, challengeId, amount } = createPaymentDto;

    const createdPayment = await this.prisma.payment.findUnique({
      where: {
        userId_challengeId_paymentType: {
          userId,
          challengeId,
          paymentType: PaymentType.REGIST_FEE,
        },
      },
    });

    let paymentId = createdPayment?.id;

    if (!createdPayment) {
      const payment = await this.prisma.payment.create({
        data: {
          userId,
          challengeId,
          amount,
        },
      });
      paymentId = payment.id;
    }

    const generateApiUrl = `${process.env.VIETQR_API}/generate`;
    const payload = {
      accountNo: process.env.BANK_ACCOUNT_NUMBER,
      acqId: process.env.BANK_ACCOUNT_BIN,
      accountName: process.env.BANK_ACCOUNT_NAME,
      amount: amount,
      addInfo: `JOINCHALLENGE ${paymentId}`,
      format: 'text',
      template: 'compact',
    };
    const headers = {
      'x-client-id': process.env.VIETQR_CLIENT_ID,
      'x-api-key': process.env.VIETQR_API_KEY,
    };

    const { data } = await firstValueFrom(
      this.httpService
        .post(generateApiUrl, payload, {
          headers,
        })
        .pipe(
          catchError((error: AxiosError) => {
            console.error(error);
            throw 'An error happened!';
          }),
        ),
    );

    return data.data;
  }

  async complete(completePaymentDto: CompletePaymentDto) {
    const { message } = completePaymentDto;
    this.eventEmitter.emit('new-payment', { data: 'trigged event!' });
    return { success: true };
  }
}
