import { prisma, type Order } from "@payrecon/db";
import type { OrderStatus } from "@payrecon/shared";

export class OrderRepository {
  findById(id: string): Promise<Order | null> {
    return prisma.order.findUnique({ where: { id } });
  }

  updateStatus(id: string, status: OrderStatus): Promise<Order> {
    return prisma.order.update({ where: { id }, data: { status } });
  }
}
