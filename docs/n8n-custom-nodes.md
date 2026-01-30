# Custom n8n Node Specifications

This document describes the custom n8n nodes designed for the Enterprise Agent Platform integration.

## Overview

The platform integrates with n8n via REST API calls and webhook callbacks. The following custom nodes are designed to enable seamless workflow orchestration between the platform and n8n.

---

## 1. Platform Trigger Node

**Purpose**: Triggers an n8n workflow when the platform initiates a workflow execution.

### Configuration
- **Webhook Path**: `/webhook/{workflowId}`
- **Authentication**: Verify request signature or API key

### Input
```json
{
  "executionId": "uuid",
  "workflowId": "uuid",
  "workerId": "uuid",
  "inputData": {},
  "triggerType": "manual|schedule|webhook",
  "timestamp": "ISO8601"
}
```

### Output
```json
{
  "json": {
    "executionId": "uuid",
    "workflowId": "uuid",
    "inputData": {}
  }
}
```

---

## 2. Human Review Node

**Purpose**: Pauses workflow execution and requests human review/approval via the Control Room.

### Configuration
| Field | Type | Description |
|-------|------|-------------|
| `reviewType` | enum | `approval`, `input_needed`, `edit_review`, `decision` |
| `stepLabel` | string | Description shown in Control Room |
| `timeoutHours` | number | Hours before review times out (default: 4) |
| `workerName` | string | Name of the digital worker requesting review |

### Input
```json
{
  "data": {},
  "context": {
    "workflowId": "uuid",
    "executionId": "uuid",
    "stepId": "uuid"
  }
}
```

### Behavior
1. Calls `POST /api/n8n/review-request` to create review request
2. Enters a wait loop polling `GET /api/n8n/review-request?id={reviewId}`
3. Resumes when status changes from `pending` to `approved|rejected|edited`

### Output
```json
{
  "json": {
    "approved": true,
    "feedback": "optional feedback",
    "editedData": {},
    "reviewerId": "uuid",
    "reviewedAt": "ISO8601"
  }
}
```

---

## 3. AI Action Node

**Purpose**: Executes an AI-powered action using the platform's Gemini integration with blueprint constraints.

### Configuration
| Field | Type | Description |
|-------|------|-------------|
| `stepLabel` | string | Description of the action |
| `blueprint` | object | `{ greenList: [], redList: [] }` constraints |
| `workerName` | string | Name of the digital worker |

### Input
```json
{
  "inputData": {},
  "guidanceContext": "optional previous guidance"
}
```

### Behavior
1. Calls `POST /api/n8n/ai-action` with step configuration and input
2. If response contains `needsGuidance: true`, routes to Human Review Node
3. Otherwise proceeds with result

### Output
```json
{
  "json": {
    "result": {},
    "actions": ["list of actions taken"],
    "message": "summary",
    "needsGuidance": false
  }
}
```

---

## 4. Platform Callback Node

**Purpose**: Reports execution status/progress back to the platform.

### Configuration
| Field | Type | Description |
|-------|------|-------------|
| `callbackType` | enum | `execution_update`, `execution_complete`, `step_complete` |

### Input (execution_update)
```json
{
  "executionId": "uuid",
  "workflowId": "uuid",
  "status": "running|waiting_review|completed|failed",
  "stepIndex": 0,
  "stepName": "Step label",
  "outputData": {}
}
```

### Behavior
- `execution_update`: Calls `POST /api/n8n/execution-update`
- `execution_complete`: Calls `POST /api/n8n/execution-complete`

### Output
Passes through input data for chaining.

---

## 5. Gmail Action Node (Optional)

**Purpose**: Performs Gmail operations using the platform's authenticated Gmail tokens.

### Configuration
| Field | Type | Description |
|-------|------|-------------|
| `action` | enum | `send`, `read`, `search`, `reply` |
| `from` | expression | Sender email address |
| `to` | expression | Recipient email address |
| `subject` | expression | Email subject |
| `body` | expression | Email body |

### Behavior
1. Retrieves OAuth tokens from platform via API
2. Performs Gmail API operations
3. Logs activity to platform

---

## Workflow Structure Example

```json
{
  "name": "Customer Support Workflow",
  "nodes": [
    {
      "id": "trigger",
      "type": "n8n-nodes-platform.trigger",
      "name": "Platform Trigger"
    },
    {
      "id": "ai_action_1",
      "type": "n8n-nodes-platform.aiAction",
      "name": "Analyze Customer Request",
      "parameters": {
        "stepLabel": "Analyze incoming customer request",
        "blueprint": {
          "greenList": ["Classify request", "Extract key information"],
          "redList": ["Make unauthorized promises", "Share customer data"]
        }
      }
    },
    {
      "id": "human_review_1",
      "type": "n8n-nodes-platform.humanReview",
      "name": "Manager Approval",
      "parameters": {
        "reviewType": "approval",
        "stepLabel": "Review AI analysis before proceeding",
        "timeoutHours": 4
      }
    },
    {
      "id": "ai_action_2",
      "type": "n8n-nodes-platform.aiAction",
      "name": "Generate Response",
      "parameters": {
        "stepLabel": "Generate customer response",
        "blueprint": {
          "greenList": ["Generate polite response", "Include relevant info"],
          "redList": ["Make promises", "Share internal info"]
        }
      }
    },
    {
      "id": "callback",
      "type": "n8n-nodes-platform.callback",
      "name": "Complete Execution",
      "parameters": {
        "callbackType": "execution_complete"
      }
    }
  ],
  "connections": {
    "Platform Trigger": {
      "main": [[{ "node": "Analyze Customer Request", "type": "main", "index": 0 }]]
    },
    "Analyze Customer Request": {
      "main": [[{ "node": "Manager Approval", "type": "main", "index": 0 }]]
    },
    "Manager Approval": {
      "main": [[{ "node": "Generate Response", "type": "main", "index": 0 }]]
    },
    "Generate Response": {
      "main": [[{ "node": "Complete Execution", "type": "main", "index": 0 }]]
    }
  }
}
```

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/n8n/webhook/[workflowId]` | POST | Trigger workflow execution |
| `/api/n8n/review-request` | POST | Create human review request |
| `/api/n8n/review-request?id=xxx` | GET | Poll review request status |
| `/api/n8n/ai-action` | POST | Execute AI action with blueprint |
| `/api/n8n/execution-update` | POST | Report execution progress |
| `/api/n8n/execution-complete` | POST | Report execution completion |

---

## Implementation Priority

1. **Phase 1**: Use n8n's built-in HTTP Request nodes to call platform APIs
2. **Phase 2**: Create community nodes for better UX
3. **Phase 3**: Consider n8n embedded or white-label for deeper integration
