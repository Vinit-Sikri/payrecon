import { NotFoundError, type CreateOrderInput } from "@payrecon/shared";
import type { Order } from "@payrecon/db";
import { OrderRepository, type ListOrdersFilter } from "../repositories/order.repository";

export class OrderService {
  constructor(private readonly orderRepository: OrderRepository = new OrderRepository()) {}

  createOrder(input: CreateOrderInput): Promise<Order> {
    return this.orderRepository.create(input);
  }

  async getOrderById(id: string): Promise<Order> {
    const order = await this.orderRepository.findById(id);
    if (!order) {
      throw new NotFoundError(`Order ${id} not found`);
    }
    return order;
  }

  listOrders(filter: ListOrdersFilter): Promise<Order[]> {
    return this.orderRepository.list(filter);
  }
}
