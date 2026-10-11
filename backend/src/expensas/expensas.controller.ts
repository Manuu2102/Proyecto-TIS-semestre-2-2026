import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CreateExpensaDto } from './dto/create-expensa.dto.js';
import { ExpensasService } from './expensas.service.js';
import { MoraService } from './mora.service.js';

@Controller('expensas')
export class ExpensasController {
  constructor(
    private readonly expensas: ExpensasService,
    private readonly mora: MoraService,
  ) {}

  @Post('previsualizar')
  previsualizar(@Body() dto: CreateExpensaDto) {
    return this.expensas.previsualizar(dto);
  }

  @Post()
  create(@Body() dto: CreateExpensaDto) {
    return this.expensas.create(dto);
  }

  @Post('mora/aplicar')
  aplicarMora() {
    return this.mora.aplicarMoraMensual();
  }

  @Get('mora/previsualizar/:idPagoExpensa')
  previsualizarMora(
    @Param('idPagoExpensa', ParseIntPipe) id: number,
  ) {
    return this.mora.previsualizarMora(BigInt(id));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.expensas.findOne(id);
  }
}