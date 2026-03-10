import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get(api.plunges.list.path, async (req, res) => {
    const allPlunges = await storage.getPlunges();
    res.json(allPlunges);
  });

  app.post(api.plunges.create.path, async (req, res) => {
    try {
      const input = api.plunges.create.input.parse(req.body);
      const newPlunge = await storage.createPlunge(input);
      res.status(201).json(newPlunge);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  return httpServer;
}
