import { prisma, type Order, type OrderStatus } from "@payrecon/db";

export interface CreateOrderData {
  amount: number;
  currency: string;
}

export interface ListOrdersFilter {
  status?: OrderStatus;
  limit: number;
  cursor?: string;
}

export class OrderRepository {
  create(data: CreateOrderData): Promise<Order> {
    return prisma.order.create({ data });
  }

  findById(id: string): Promise<Order | null> {
    return prisma.order.findUnique({ where: { id } });
  }

  list(filter: ListOrdersFilter): Promise<Order[]> {
    return prisma.order.findMany({
      where: filter.status ? { status: filter.status } : undefined,
      take: filter.limit,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
    });
  }
}
