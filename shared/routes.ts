import { z } from "zod";
import { insertPlungeSchema, updatePlungeSchema, insertLeaderboardEntrySchema, plunges, leaderboardEntries } from "./schema";

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
      input: insertPlungeSchema.extend({
        score: z.string().or(z.number()),
        hrAvg: z.number().int().nullable().optional(),
        spo2Avg: z.number().int().nullable().optional(),
        createdAt: z.string().optional(), // ISO string for manual backdated entry
      }),
      responses: {
        201: z.custom<typeof plunges.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: "PATCH" as const,
      path: "/api/plunges/:id" as const,
      input: updatePlungeSchema,
      responses: {
        200: z.custom<typeof plunges.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/plunges/:id" as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  leaderboard: {
    list: {
      method: "GET" as const,
      path: "/api/leaderboard/:locationId" as const,
      responses: {
        200: z.array(z.custom<typeof leaderboardEntries.$inferSelect>()),
      },
    },
    submit: {
      method: "POST" as const,
      path: "/api/leaderboard" as const,
      input: insertLeaderboardEntrySchema.extend({
        score: z.string().or(z.number()),
        verificationLevel: z.number().int().min(0).max(3).optional(),
        hasPhoto: z.boolean().optional(),
      }),
      responses: {
        201: z.custom<typeof leaderboardEntries.$inferSelect>(),
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
export type PlungeUpdateInput = z.infer<typeof api.plunges.update.input>;
export type PlungeResponse = z.infer<typeof api.plunges.create.responses[201]>;
export type PlungesListResponse = z.infer<typeof api.plunges.list.responses[200]>;
