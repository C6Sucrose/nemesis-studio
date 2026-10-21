import { DialogueDefinition, DialogueNode, DialogueChoice } from '@nemesis/shared';

export interface DialogueControllerState {
  currentNodeId: string | null;
  isFinished: boolean;
  history: string[];
}

export class DialogueController {
  private definition: DialogueDefinition;
  private currentNodeId: string | null = null;
  private finished: boolean = false;
  private history: string[] = [];

  private static readonly FALLBACK_NODE: DialogueNode = {
    speaker: 'Narrator',
    text: '... (The conversation trails off into silence.)',
    choices: []
  };

  constructor(definition: DialogueDefinition) {
    this.definition = definition;
    this.reset();
  }

  public reset(): void {
    this.history = [];
    const initialId = this.definition.initialNodeId;

    if (!initialId || !this.definition.nodes || !this.definition.nodes[initialId]) {
      // Gracefully handle missing initial node
      this.currentNodeId = null;
      this.finished = true;
      return;
    }

    this.currentNodeId = initialId;
    this.history.push(initialId);
    const initialNode = this.definition.nodes[initialId];
    this.finished = !initialNode.choices || initialNode.choices.length === 0;
  }

  public getCurrentNodeId(): string | null {
    return this.currentNodeId;
  }

  public getCurrentNode(): DialogueNode | null {
    if (!this.currentNodeId) {
      return DialogueController.FALLBACK_NODE;
    }

    const node = this.definition.nodes[this.currentNodeId];
    if (!node) {
      // Missing ID fallback (Review Focus #1)
      return DialogueController.FALLBACK_NODE;
    }

    return node;
  }

  public isFinished(): boolean {
    if (this.finished) return true;
    const node = this.getCurrentNode();
    if (!node || !node.choices || node.choices.length === 0) {
      return true;
    }
    return false;
  }

  public getHistory(): readonly string[] {
    return this.history;
  }

  public selectChoice(choiceIndex: number): boolean {
    if (this.finished && !this.currentNodeId) {
      return false;
    }

    const currentNode = this.getCurrentNode();
    if (!currentNode || !currentNode.choices || currentNode.choices.length === 0) {
      this.finished = true;
      return false;
    }

    if (choiceIndex < 0 || choiceIndex >= currentNode.choices.length) {
      return false;
    }

    const choice: DialogueChoice = currentNode.choices[choiceIndex];

    // Terminal choice (null or empty nextNodeId)
    if (!choice.nextNodeId) {
      this.currentNodeId = null;
      this.finished = true;
      return true;
    }

    // Check if nextNodeId exists in nodes
    const targetId = choice.nextNodeId;
    this.history.push(targetId);

    if (!this.definition.nodes || !this.definition.nodes[targetId]) {
      // Graceful fallback on missing/dangling ID (Review Focus #1)
      this.currentNodeId = targetId; // Track the ID
      this.finished = true;
      return true;
    }

    // Valid next node
    this.currentNodeId = targetId;
    const nextNode = this.definition.nodes[targetId];
    if (!nextNode.choices || nextNode.choices.length === 0) {
      this.finished = true;
    }

    return true;
  }
}
