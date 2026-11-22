/**
 * Default goal-run planner and step executor. Both use the LLM seam (route
 * names only, never a model id) and produce contract-valid data parts.
 * Tests inject deterministic fakes through `GoalRunEngine` instead.
 */
import { planSchema, type Plan } from '@agent-chat/contract';
import { generateObject, generateText } from 'ai';
import type { Llm } from '../llm';
import type { PlanGenerator, StepExecutor, StepResult } from './types';

const PLANNER_PROMPT = `You are a planning assistant for a local development agent.
Produce a short plan for the user's goal. Each step needs a concrete title and
an executable success predicate a program could check. Return at most 5 steps.
Do not perform any action; only plan.
Steering guidance from the user (if any) must be reflected in the steps.`;

const STEP_PROMPT = `You are executing one step of a goal plan.
Return a concise summary of what was done and whether the success predicate
was met. You have no tools and must not claim to have performed side effects.
Steering guidance from the user (if any) changes what you do next.`;

export function createLlmPlanner(llm: Llm): PlanGenerator {
  return {
    async plan({ goal, revision, steerInstructions, priorCheckpoints }) {
      const steer = steerInstructions.length
        ? `\nUser guidance: ${steerInstructions.join(' | ')}`
        : '';
      const prior = priorCheckpoints.length
        ? `\nPrior outcomes: ${priorCheckpoints
            .map(c => `${c.stepId}: ${c.status} ${c.summary ?? ''}`)
            .join('; ')}`
        : '';
      const { object } = await generateObject({
        model: llm.model('deep'),
        schema: planSchema,
        prompt: `${PLANNER_PROMPT}\nGoal: ${goal}\nRevision: ${revision}${steer}${prior}`,
        temperature: 0,
      });
      return object as Plan;
    },
  };
}

export function createLlmStepExecutor(llm: Llm): StepExecutor {
  return {
    async execute({
      step,
      attempt,
      steerInstructions,
      phase,
    }): Promise<StepResult> {
      const steer = steerInstructions.length
        ? `\nUser guidance: ${steerInstructions.join(' | ')}`
        : '';
      const { text } = await generateText({
        model: llm.model('fast'),
        system: STEP_PROMPT,
        prompt: `Step: ${step.title}\nSuccess predicate: ${step.successPredicate}\nAttempt: ${attempt}\nPhase: ${phase}${steer}`,
        temperature: 0,
      });
      // The default executor is deliberately read-only: it never emits an
      // `effect`, so no consequential tool can run without a dedicated tool
      // executor (card 6) implementing the approve/commit contract.
      return {
        predicatePassed: text.trim().length > 0,
        summary: text.slice(0, 2000),
        costUnits: Math.ceil(text.length / 4),
      };
    },
  };
}
