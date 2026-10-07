import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CreateExpensaDto } from './dto/create-expensa.dto.js';
import { ExpensasService } from './expensas.service.js';

@Controller('expensas')
export class ExpensasController {
  constructor(private readonly expensas: ExpensasService) {}

  @Post('previsualizar')
  previsualizar(@Body() dto: CreateExpensaDto) {
    return this.expensas.previsualizar(dto);
  }

  @Post()
  create(@Body() dto: CreateExpensaDto) {
    return this.expensas.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.expensas.findOne(id);
  }
}
