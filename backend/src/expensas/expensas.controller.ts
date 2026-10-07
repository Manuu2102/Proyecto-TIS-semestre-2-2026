import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CreateExpensaDto } from './dto/create-expensa.dto.js';
import { GenerarDeudasDto } from './dto/generar-deudas.dto.js';
import { ExpensasService } from './expensas.service.js';

// Agrega aquí el guard de autenticación que ya usas, por ejemplo:
// @UseGuards(JwtAuthGuard)
@Controller('expensas')
export class ExpensasController {
  constructor(private readonly expensas: ExpensasService) {}

  /** Calcula el reparto por departamento sin guardar nada. */
  @Post('previsualizar')
  previsualizar(@Body() dto: CreateExpensaDto) {
    return this.expensas.previsualizar(dto);
  }

  /** Crea la expensa y genera las deudas del mes actual. */
  @Post()
  create(@Body() dto: CreateExpensaDto) {
    return this.expensas.create(dto);
  }

  /** Hace lo mismo que el cron mensual, a demanda. Útil para probar. */
  @Post('generar-deudas-mensuales')
  generarDeudasMensuales() {
    return this.expensas.generarDeudasMensuales();
  }

  /** Genera las deudas de un mes para una expensa existente. */
  @Post(':id/generar-deudas')
  generarDeudas(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GenerarDeudasDto,
  ) {
    return this.expensas.generarDeudas(id, dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.expensas.findOne(id);
  }
}