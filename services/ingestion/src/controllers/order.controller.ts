import type { FastifyReply, FastifyRequest } from "fastify";
import { createOrderSchema, orderIdParamSchema, listOrdersQuerySchema, ValidationError } from "@payrecon/shared";
import type { OrderService } from "../services/order.service";

export function createOrderController(orderService: OrderService) {
  return {
    async createOrder(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const parsed = createOrderSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError("Invalid order payload", parsed.error.flatten());
      }

      const order = await orderService.createOrder(parsed.data);
      reply.status(201).send(order);
    },

    async getOrder(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const parsedParams = orderIdParamSchema.safeParse(request.params);
      if (!parsedParams.success) {
        throw new ValidationError("Invalid order id", parsedParams.error.flatten());
      }

      const order = await orderService.getOrderById(parsedParams.data.id);
      reply.status(200).send(order);
    },

    async listOrders(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const parsedQuery = listOrdersQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        throw new ValidationError("Invalid query parameters", parsedQuery.error.flatten());
      }

      const orders = await orderService.listOrders(parsedQuery.data);
      reply.status(200).send({ orders });
    },
  };
}
