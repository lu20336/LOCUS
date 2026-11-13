/**
 * Pagos de LOCUS: HOY SON SIMULADOS. Ninguna reserva cobra dinero; el campo
 * `payment.mode = 'simulado'` queda registrado y las reglas de Firestore
 * (firestore.rules → bookingCommon) RECHAZAN cualquier otro modo.
 *
 * Para cobrar de verdad hace falta (ver docs/ARQUITECTURA.md §10):
 *   1. una cuenta comercial en una pasarela (Wompi, Mercado Pago, PayU o ePayco),
 *   2. un backend que firme el cobro con la llave SECRETA y reciba los webhooks
 *      (Cloud Functions → requiere plan Blaze, u otro servidor),
 *   3. cambiar la reserva a "pendiente de pago" hasta que el webhook confirme,
 *   4. ampliar las reglas para aceptar el modo 'sandbox' / 'real' solo desde el servidor.
 * Nada de eso está activo: este archivo es el único punto donde cambiaría.
 */
import type { BookingPayment } from '../domain/types'

export const SIMULATED_PAYMENT: BookingPayment = { mode: 'simulado', status: 'simulated_paid' }
