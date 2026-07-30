import type { FastifyInstance } from "fastify";
import { createPaymentController } from "../controllers/payment.controller";
import type { SimulationService } from "../services/simulation.service";

export function paymentRoutes(simulationService: SimulationService) {
  const controller = createPaymentController(simulationService);

  return async function routes(app: FastifyInstance): Promise<void> {
    // Simulates initiating a payment against the gateway for an order. The
    // real webhook confirming SUCCESS/FAILED/PENDING arrives asynchronously.
    app.post("/", controller.simulatePayment);
  };
}
