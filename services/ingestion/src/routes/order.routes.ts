import type { FastifyInstance } from "fastify";
import { createOrderController } from "../controllers/order.controller";
import type { OrderService } from "../services/order.service";

const orderSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    amount: { type: "integer", description: "Minor units (e.g. cents)" },
    currency: { type: "string" },
    status: { type: "string", enum: ["CREATED", "PAID", "CANCELLED", "REFUNDED"] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

export function orderRoutes(orderService: OrderService) {
  const controller = createOrderController(orderService);

  return async function routes(app: FastifyInstance): Promise<void> {
    app.post(
      "/",
      {
        schema: {
          tags: ["orders"],
          summary: "Create a mock order",
          response: { 201: orderSchema },
        },
      },
      controller.createOrder,
    );

    app.get(
      "/:id",
      {
        schema: {
          tags: ["orders"],
          summary: "Get an order by id",
          response: { 200: orderSchema },
        },
      },
      controller.getOrder,
    );

    app.get(
      "/",
      {
        schema: {
          tags: ["orders"],
          summary: "List orders",
          response: {
            200: { type: "object", properties: { orders: { type: "array", items: orderSchema } } },
          },
        },
      },
      controller.listOrders,
    );
  };
}
