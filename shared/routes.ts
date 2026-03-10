import { z } from "zod";
import { insertPlungeSchema, plunges } from "./schema";

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  plunges: {
    list: {
      method: "GET" as const,
      path: "/api/plunges" as const,
      responses: {
        200: z.array(z.custom<typeof plunges.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/plunges" as const,
      input: insertPlungeSchema,
      responses: {
        201: z.custom<typeof plunges.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type PlungeInput = z.infer<typeof api.plunges.create.input>;
export type PlungeResponse = z.infer<typeof api.plunges.create.responses[201]>;
export type PlungesListResponse = z.infer<typeof api.plunges.list.responses[200]>;
