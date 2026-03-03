import type { FastifyRequest } from "fastify";

type JwtUser = {
  userId: string;
  email: string;
};

export function getAuthUser(request: FastifyRequest): JwtUser {
  return request.user as JwtUser;
}
