import { describe, it, expect } from 'vitest';
import { DialogueController } from '../src/engine/DialogueController';

describe('DialogueController', () => {
  const sampleDialogue = {
    initialNodeId: 'node_welcome',
    nodes: {
      node_welcome: {
        speaker: 'Elder Eldrin',
        text: 'Greetings, chosen one. The clock tower has ceased ticking.',
        choices: [
          { text: 'I will investigate.', nextNodeId: 'node_accept' },
          { text: 'Not my problem.', nextNodeId: 'node_refuse' },
          { text: 'Point to broken link', nextNodeId: 'node_broken_404' }
        ]
      },
      node_accept: {
        speaker: 'Elder Eldrin',
        text: 'Take this gear key and restore the chimes.',
        choices: [
          { text: 'Farewell.', nextNodeId: null }
        ]
      },
      node_refuse: {
        speaker: 'Elder Eldrin',
        text: 'Then our kingdom is doomed.',
        choices: []
      }
    }
  };

  it('initializes at the initial node and exposes speaker, text, and choices', () => {
    const controller = new DialogueController(sampleDialogue);

    const current = controller.getCurrentNode();
    expect(current).not.toBeNull();
    expect(current?.speaker).toBe('Elder Eldrin');
    expect(current?.text).toContain('The clock tower has ceased ticking');
    expect(current?.choices).toHaveLength(3);
    expect(controller.isFinished()).toBe(false);
  });

  it('advances through valid dialogue choices to termination', () => {
    const controller = new DialogueController(sampleDialogue);

    // Choose "I will investigate" (choice 0)
    const success = controller.selectChoice(0);
    expect(success).toBe(true);

    const nodeAccept = controller.getCurrentNode();
    expect(nodeAccept?.text).toContain('gear key');
    expect(controller.isFinished()).toBe(false);

    // Choose "Farewell" (choice 0 with nextNodeId null)
    controller.selectChoice(0);
    expect(controller.isFinished()).toBe(true);
  });

  it('gracefully handles choices pointing to missing/dangling node IDs (Review Focus #1)', () => {
    const controller = new DialogueController(sampleDialogue);

    // Select choice 2 which points to 'node_broken_404'
    const success = controller.selectChoice(2);
    expect(success).toBe(true);

    // System should not throw or crash; it safely falls back to a safe termination/fallback node
    const fallbackNode = controller.getCurrentNode();
    expect(fallbackNode).toBeDefined();
    // It should either provide a fallback explanation or mark as finished
    expect(controller.isFinished() || (fallbackNode?.text?.length ?? 0) > 0).toBe(true);
  });

  it('handles completely malformed dialogue definitions safely', () => {
    // Missing initial node
    const brokenDialogue = {
      initialNodeId: 'does_not_exist',
      nodes: {}
    };

    const controller = new DialogueController(brokenDialogue);
    expect(controller.getCurrentNode()).not.toBeNull();
    expect(controller.isFinished()).toBe(true);
  });

  it('supports dialogue reset to initial state', () => {
    const controller = new DialogueController(sampleDialogue);
    controller.selectChoice(1); // 'node_refuse' has no choices -> ends
    expect(controller.isFinished()).toBe(true);

    controller.reset();
    expect(controller.isFinished()).toBe(false);
    expect(controller.getCurrentNode()?.text).toContain('clock tower');
  });

  it('handles out-of-bounds choice selection gracefully', () => {
    const controller = new DialogueController(sampleDialogue);
    const result = controller.selectChoice(99);
    expect(result).toBe(false);
    expect(controller.getCurrentNode()?.text).toContain('clock tower');
  });
});
