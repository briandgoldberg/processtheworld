/* Built-in CRM examples: sales, service and marketing (generated from the agent format). */
export const CRM_EXAMPLES = [
 {
  "id": "ex_mql",
  "example": true,
  "visibility": "public",
  "title": "Score a lead and hand off the MQL to sales",
  "updatedAt": 0,
  "tags": [
   "business",
   "marketing",
   "sales",
   "crm"
  ],
  "maps": {
   "m_root": {
    "id": "m_root",
    "title": "Score a lead and hand off the MQL to sales",
    "parent": null,
    "lanes": [
     {
      "id": "prospect",
      "name": "Prospect",
      "type": "person"
     },
     {
      "id": "mops",
      "name": "Marketing ops",
      "type": "person"
     },
     {
      "id": "ma",
      "name": "Marketing automation",
      "type": "system"
     },
     {
      "id": "crm",
      "name": "CRM",
      "type": "system"
     },
     {
      "id": "sdr",
      "name": "Sales development rep",
      "type": "person"
     }
    ],
    "steps": [
     {
      "id": "a1",
      "lane": "prospect",
      "label": "Fills out a form or downloads a guide",
      "kind": "start",
      "uses": [],
      "next": [
       {
        "to": "a2"
       }
      ]
     },
     {
      "id": "a2",
      "lane": "ma",
      "label": "Capture the lead and log the activity",
      "kind": "task",
      "uses": [
       "crm"
      ],
      "next": [
       {
        "to": "a3"
       }
      ]
     },
     {
      "id": "a3",
      "lane": "ma",
      "label": "Score fit and engagement",
      "kind": "subprocess",
      "uses": [],
      "next": [
       {
        "to": "a4"
       }
      ],
      "child": "m_score"
     },
     {
      "id": "a4",
      "lane": "ma",
      "label": "Score over the MQL threshold?",
      "kind": "decision",
      "uses": [],
      "next": [
       {
        "to": "a6",
        "label": "Yes"
       },
       {
        "to": "a5",
        "label": "No"
       }
      ]
     },
     {
      "id": "a5",
      "lane": "ma",
      "label": "Keep nurturing until new activity",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "a3",
        "label": "New activity"
       }
      ]
     },
     {
      "id": "a6",
      "lane": "crm",
      "label": "Mark as MQL and route to a rep by territory",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "a7"
       }
      ],
      "pain": {
       "level": 2,
       "note": "Routing rules drift as territories change, so leads land with the wrong rep"
      }
     },
     {
      "id": "a7",
      "lane": "sdr",
      "label": "Reach out within the response SLA",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "a8"
       }
      ],
      "pain": {
       "level": 3,
       "note": "Interest fades fast; a slow first touch wastes the lead"
      }
     },
     {
      "id": "a8",
      "lane": "sdr",
      "label": "Real buying interest?",
      "kind": "decision",
      "uses": [],
      "next": [
       {
        "to": "a9",
        "label": "Yes"
       },
       {
        "to": "a10",
        "label": "No"
       }
      ]
     },
     {
      "id": "a9",
      "lane": "sdr",
      "label": "Accept it and book a discovery call",
      "kind": "task",
      "uses": [
       "crm"
      ],
      "next": [
       {
        "to": "a12"
       }
      ]
     },
     {
      "id": "a10",
      "lane": "sdr",
      "label": "Reject it with a reason",
      "kind": "task",
      "uses": [
       "crm"
      ],
      "next": [
       {
        "to": "a11"
       }
      ]
     },
     {
      "id": "a11",
      "lane": "mops",
      "label": "Review reject reasons and tune the scoring",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "a13"
       }
      ]
     },
     {
      "id": "a12",
      "lane": "sdr",
      "label": "Handed to sales as a qualified lead",
      "kind": "end",
      "uses": [],
      "next": []
     },
     {
      "id": "a13",
      "lane": "ma",
      "label": "Lead goes back to nurture",
      "kind": "end",
      "uses": [],
      "next": []
     }
    ]
   },
   "m_score": {
    "id": "m_score",
    "title": "Score fit and engagement",
    "parent": {
     "map": "m_root",
     "step": "a3"
    },
    "lanes": [
     {
      "id": "s_ops",
      "name": "Marketing ops",
      "type": "person"
     },
     {
      "id": "s_ma",
      "name": "Marketing automation",
      "type": "system"
     }
    ],
    "steps": [
     {
      "id": "s1",
      "lane": "s_ops",
      "label": "Agree the scoring rules with sales",
      "kind": "start",
      "uses": [],
      "next": [
       {
        "to": "s2"
       }
      ]
     },
     {
      "id": "s2",
      "lane": "s_ma",
      "label": "Add fit points: job title, industry, company size",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "s3"
       }
      ]
     },
     {
      "id": "s3",
      "lane": "s_ma",
      "label": "Add engagement points: visits, opens, webinars",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "s4"
       }
      ]
     },
     {
      "id": "s4",
      "lane": "s_ma",
      "label": "Subtract points for weeks of silence",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "s5"
       }
      ]
     },
     {
      "id": "s5",
      "lane": "s_ma",
      "label": "Asked for a demo or pricing?",
      "kind": "decision",
      "uses": [],
      "next": [
       {
        "to": "s6",
        "label": "Yes"
       },
       {
        "to": "s7",
        "label": "No"
       }
      ]
     },
     {
      "id": "s6",
      "lane": "s_ma",
      "label": "Fast-track straight to MQL",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "s7"
       }
      ]
     },
     {
      "id": "s7",
      "lane": "s_ma",
      "label": "Score updated",
      "kind": "end",
      "uses": [],
      "next": []
     }
    ]
   }
  },
  "chat": [],
  "events": []
 },
 {
  "id": "ex_pipeline",
  "example": true,
  "visibility": "public",
  "title": "Manage the pipeline and call the forecast",
  "updatedAt": 0,
  "tags": [
   "business",
   "sales",
   "crm",
   "forecasting"
  ],
  "maps": {
   "m_root": {
    "id": "m_root",
    "title": "Manage the pipeline and call the forecast",
    "parent": null,
    "lanes": [
     {
      "id": "ae",
      "name": "Account executive",
      "type": "person"
     },
     {
      "id": "mgr",
      "name": "Sales manager",
      "type": "person"
     },
     {
      "id": "buyer",
      "name": "Buyer",
      "type": "person"
     },
     {
      "id": "crm",
      "name": "CRM",
      "type": "system"
     }
    ],
    "steps": [
     {
      "id": "o1",
      "lane": "ae",
      "label": "Qualified opportunity created",
      "kind": "start",
      "uses": [],
      "next": [
       {
        "to": "o2"
       }
      ]
     },
     {
      "id": "o2",
      "lane": "ae",
      "label": "Set amount, close date and stage",
      "kind": "task",
      "uses": [
       "crm"
      ],
      "next": [
       {
        "to": "o3"
       }
      ]
     },
     {
      "id": "o3",
      "lane": "ae",
      "label": "Move the deal through the stages",
      "kind": "subprocess",
      "uses": [],
      "next": [
       {
        "to": "o4"
       }
      ],
      "child": "m_stages"
     },
     {
      "id": "o4",
      "lane": "ae",
      "label": "Update the forecast category each week: commit, best case, pipeline",
      "kind": "task",
      "uses": [
       "crm"
      ],
      "next": [
       {
        "to": "o5"
       }
      ]
     },
     {
      "id": "o5",
      "lane": "crm",
      "label": "Roll up the forecast by rep and team",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "o6"
       }
      ]
     },
     {
      "id": "o6",
      "lane": "mgr",
      "label": "Inspect deals on the weekly forecast call",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "o7"
       }
      ],
      "pain": {
       "level": 2,
       "note": "Close dates get pushed quarter after quarter, hiding real risk"
      }
     },
     {
      "id": "o7",
      "lane": "mgr",
      "label": "Deal real for this quarter?",
      "kind": "decision",
      "uses": [],
      "next": [
       {
        "to": "o8",
        "label": "Yes"
       },
       {
        "to": "o9",
        "label": "No"
       }
      ]
     },
     {
      "id": "o8",
      "lane": "mgr",
      "label": "Call the number to leadership",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "o10"
       }
      ]
     },
     {
      "id": "o9",
      "lane": "ae",
      "label": "Move the close date or mark Closed Lost with a reason",
      "kind": "task",
      "uses": [
       "crm"
      ],
      "next": [
       {
        "to": "o12"
       }
      ]
     },
     {
      "id": "o10",
      "lane": "buyer",
      "label": "Signs the contract?",
      "kind": "decision",
      "uses": [],
      "next": [
       {
        "to": "o11",
        "label": "Yes"
       },
       {
        "to": "o9",
        "label": "No"
       }
      ]
     },
     {
      "id": "o11",
      "lane": "ae",
      "label": "Mark Closed Won and hand off to onboarding",
      "kind": "task",
      "uses": [
       "crm"
      ],
      "next": [
       {
        "to": "o13"
       }
      ]
     },
     {
      "id": "o12",
      "lane": "crm",
      "label": "Pipeline cleaned up",
      "kind": "end",
      "uses": [],
      "next": []
     },
     {
      "id": "o13",
      "lane": "crm",
      "label": "Revenue booked",
      "kind": "end",
      "uses": [],
      "next": []
     }
    ]
   },
   "m_stages": {
    "id": "m_stages",
    "title": "Move the deal through the stages",
    "parent": {
     "map": "m_root",
     "step": "o3"
    },
    "lanes": [
     {
      "id": "t_ae",
      "name": "Account executive",
      "type": "person"
     },
     {
      "id": "t_buyer",
      "name": "Buyer",
      "type": "person"
     },
     {
      "id": "t_crm",
      "name": "CRM",
      "type": "system"
     }
    ],
    "steps": [
     {
      "id": "t1",
      "lane": "t_ae",
      "label": "Discovery done",
      "kind": "start",
      "uses": [],
      "next": [
       {
        "to": "t2"
       }
      ]
     },
     {
      "id": "t2",
      "lane": "t_ae",
      "label": "Confirm decision makers, budget and criteria",
      "kind": "task",
      "uses": [
       "t_crm"
      ],
      "next": [
       {
        "to": "t3"
       }
      ]
     },
     {
      "id": "t3",
      "lane": "t_buyer",
      "label": "Sees a demo of the solution",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "t4"
       }
      ]
     },
     {
      "id": "t4",
      "lane": "t_ae",
      "label": "Send the proposal",
      "kind": "task",
      "uses": [
       "t_crm"
      ],
      "next": [
       {
        "to": "t5"
       }
      ]
     },
     {
      "id": "t5",
      "lane": "t_buyer",
      "label": "Ready to negotiate?",
      "kind": "decision",
      "uses": [],
      "next": [
       {
        "to": "t6",
        "label": "Yes"
       },
       {
        "to": "t7",
        "label": "No"
       }
      ]
     },
     {
      "id": "t7",
      "lane": "t_ae",
      "label": "Find the blocker and address it",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "t3"
       }
      ]
     },
     {
      "id": "t6",
      "lane": "t_ae",
      "label": "Negotiate terms",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "t8"
       }
      ]
     },
     {
      "id": "t8",
      "lane": "t_ae",
      "label": "Ready to close",
      "kind": "end",
      "uses": [],
      "next": []
     }
    ]
   }
  },
  "chat": [],
  "events": []
 },
 {
  "id": "ex_escalate",
  "example": true,
  "visibility": "public",
  "title": "Escalate a support case before the SLA breaks",
  "updatedAt": 0,
  "tags": [
   "business",
   "service",
   "support",
   "crm"
  ],
  "maps": {
   "m_root": {
    "id": "m_root",
    "title": "Escalate a support case before the SLA breaks",
    "parent": null,
    "lanes": [
     {
      "id": "cust",
      "name": "Customer",
      "type": "person"
     },
     {
      "id": "t1a",
      "name": "Tier 1 agent",
      "type": "person"
     },
     {
      "id": "t2s",
      "name": "Tier 2 specialist",
      "type": "person"
     },
     {
      "id": "console",
      "name": "Service console",
      "type": "system"
     },
     {
      "id": "kb",
      "name": "Knowledge base",
      "type": "system"
     }
    ],
    "steps": [
     {
      "id": "c1",
      "lane": "cust",
      "label": "Reports a problem by email, chat or web form",
      "kind": "start",
      "uses": [],
      "next": [
       {
        "to": "c2"
       }
      ]
     },
     {
      "id": "c2",
      "lane": "console",
      "label": "Create a case and apply the customer's entitlement",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "c3"
       },
       {
        "to": "c15"
       }
      ]
     },
     {
      "id": "c15",
      "lane": "console",
      "label": "Track SLA milestones and warn the owner before a breach",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "c16"
       }
      ],
      "pain": {
       "level": 2,
       "note": "Warnings that fire too late leave no time to act"
      }
     },
     {
      "id": "c16",
      "lane": "console",
      "label": "SLA met or flagged",
      "kind": "end",
      "uses": [],
      "next": []
     },
     {
      "id": "c3",
      "lane": "t1a",
      "label": "Search knowledge for a known fix",
      "kind": "task",
      "uses": [
       "kb"
      ],
      "next": [
       {
        "to": "c4"
       }
      ]
     },
     {
      "id": "c4",
      "lane": "t1a",
      "label": "Fix found?",
      "kind": "decision",
      "uses": [],
      "next": [
       {
        "to": "c5",
        "label": "Yes"
       },
       {
        "to": "c6",
        "label": "No"
       }
      ]
     },
     {
      "id": "c5",
      "lane": "t1a",
      "label": "Send the fix to the customer",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "c11"
       }
      ]
     },
     {
      "id": "c6",
      "lane": "t1a",
      "label": "Can Tier 1 solve it?",
      "kind": "decision",
      "uses": [],
      "next": [
       {
        "to": "c7",
        "label": "Yes"
       },
       {
        "to": "c8",
        "label": "No"
       }
      ]
     },
     {
      "id": "c7",
      "lane": "t1a",
      "label": "Troubleshoot and resolve",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "c11"
       }
      ]
     },
     {
      "id": "c8",
      "lane": "console",
      "label": "Escalate to Tier 2 with full notes",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "c9"
       }
      ],
      "pain": {
       "level": 3,
       "note": "Thin handoff notes make customers repeat everything"
      }
     },
     {
      "id": "c9",
      "lane": "t2s",
      "label": "Investigate and fix",
      "kind": "subprocess",
      "uses": [],
      "next": [
       {
        "to": "c10"
       }
      ],
      "child": "m_investigate"
     },
     {
      "id": "c10",
      "lane": "t2s",
      "label": "Write or update a knowledge article",
      "kind": "task",
      "uses": [
       "kb"
      ],
      "next": [
       {
        "to": "c11"
       }
      ]
     },
     {
      "id": "c11",
      "lane": "cust",
      "label": "Problem solved?",
      "kind": "decision",
      "uses": [],
      "next": [
       {
        "to": "c12",
        "label": "Yes"
       },
       {
        "to": "c13",
        "label": "No"
       }
      ]
     },
     {
      "id": "c13",
      "lane": "console",
      "label": "Reopen the case",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "c6"
       }
      ]
     },
     {
      "id": "c12",
      "lane": "console",
      "label": "Close the case and send a satisfaction survey",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "c14"
       }
      ]
     },
     {
      "id": "c14",
      "lane": "cust",
      "label": "Case closed",
      "kind": "end",
      "uses": [],
      "next": []
     }
    ]
   },
   "m_investigate": {
    "id": "m_investigate",
    "title": "Investigate and fix",
    "parent": {
     "map": "m_root",
     "step": "c9"
    },
    "lanes": [
     {
      "id": "i_t2",
      "name": "Tier 2 specialist",
      "type": "person"
     },
     {
      "id": "i_eng",
      "name": "Engineering",
      "type": "person"
     },
     {
      "id": "i_console",
      "name": "Service console",
      "type": "system"
     }
    ],
    "steps": [
     {
      "id": "i1",
      "lane": "i_t2",
      "label": "Reproduce the issue",
      "kind": "start",
      "uses": [],
      "next": [
       {
        "to": "i2"
       }
      ]
     },
     {
      "id": "i2",
      "lane": "i_t2",
      "label": "A product bug?",
      "kind": "decision",
      "uses": [],
      "next": [
       {
        "to": "i3",
        "label": "Yes"
       },
       {
        "to": "i7",
        "label": "No"
       }
      ]
     },
     {
      "id": "i3",
      "lane": "i_console",
      "label": "Link the case to a bug report",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "i4"
       }
      ]
     },
     {
      "id": "i4",
      "lane": "i_eng",
      "label": "Fix and release",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "i5"
       }
      ]
     },
     {
      "id": "i7",
      "lane": "i_t2",
      "label": "Fix the setup or data",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "i5"
       }
      ]
     },
     {
      "id": "i5",
      "lane": "i_t2",
      "label": "Confirm the fix with the customer",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "i6"
       }
      ]
     },
     {
      "id": "i6",
      "lane": "i_t2",
      "label": "Fixed",
      "kind": "end",
      "uses": [],
      "next": []
     }
    ]
   }
  },
  "chat": [],
  "events": []
 },
 {
  "id": "ex_nurture",
  "example": true,
  "visibility": "public",
  "title": "Run an email nurture journey",
  "updatedAt": 0,
  "tags": [
   "business",
   "marketing",
   "email",
   "crm"
  ],
  "maps": {
   "m_root": {
    "id": "m_root",
    "title": "Run an email nurture journey",
    "parent": null,
    "lanes": [
     {
      "id": "mkt",
      "name": "Marketer",
      "type": "person"
     },
     {
      "id": "contact",
      "name": "Contact",
      "type": "person"
     },
     {
      "id": "ma",
      "name": "Marketing automation",
      "type": "system"
     },
     {
      "id": "crm",
      "name": "CRM",
      "type": "system"
     }
    ],
    "steps": [
     {
      "id": "n1",
      "lane": "mkt",
      "label": "Pick an audience and a goal",
      "kind": "start",
      "uses": [],
      "next": [
       {
        "to": "n2"
       }
      ]
     },
     {
      "id": "n2",
      "lane": "mkt",
      "label": "Build the segment",
      "kind": "subprocess",
      "uses": [
       "crm"
      ],
      "next": [
       {
        "to": "n3"
       }
      ],
      "child": "m_segment"
     },
     {
      "id": "n3",
      "lane": "ma",
      "label": "Contact enters the journey",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "n4"
       }
      ]
     },
     {
      "id": "n4",
      "lane": "ma",
      "label": "Send email 1: something genuinely useful",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "n5"
       }
      ],
      "pain": {
       "level": 2,
       "note": "Too many sends drive unsubscribes"
      }
     },
     {
      "id": "n5",
      "lane": "ma",
      "label": "Wait a few days",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "n6"
       }
      ]
     },
     {
      "id": "n6",
      "lane": "contact",
      "label": "Opened or clicked?",
      "kind": "decision",
      "uses": [],
      "next": [
       {
        "to": "n7",
        "label": "Yes"
       },
       {
        "to": "n8",
        "label": "No"
       }
      ]
     },
     {
      "id": "n8",
      "lane": "ma",
      "label": "Resend with a new subject line",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "n9"
       }
      ]
     },
     {
      "id": "n9",
      "lane": "contact",
      "label": "Engaged now?",
      "kind": "decision",
      "uses": [],
      "next": [
       {
        "to": "n7",
        "label": "Yes"
       },
       {
        "to": "n10",
        "label": "No"
       }
      ]
     },
     {
      "id": "n10",
      "lane": "ma",
      "label": "Move to a low-frequency list",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "n14"
       }
      ]
     },
     {
      "id": "n7",
      "lane": "ma",
      "label": "Send email 2: a customer story",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "n11"
       }
      ]
     },
     {
      "id": "n11",
      "lane": "contact",
      "label": "Visited pricing or asked for a demo?",
      "kind": "decision",
      "uses": [],
      "next": [
       {
        "to": "n12",
        "label": "Yes"
       },
       {
        "to": "n13",
        "label": "No"
       }
      ]
     },
     {
      "id": "n12",
      "lane": "crm",
      "label": "Alert sales and pause the journey",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "n15"
       }
      ]
     },
     {
      "id": "n13",
      "lane": "ma",
      "label": "Send email 3: a clear offer",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "n16"
       }
      ]
     },
     {
      "id": "n14",
      "lane": "ma",
      "label": "Exited quietly",
      "kind": "end",
      "uses": [],
      "next": []
     },
     {
      "id": "n15",
      "lane": "crm",
      "label": "Handed to sales",
      "kind": "end",
      "uses": [],
      "next": []
     },
     {
      "id": "n16",
      "lane": "mkt",
      "label": "Journey complete: review results",
      "kind": "end",
      "uses": [],
      "next": []
     }
    ]
   },
   "m_segment": {
    "id": "m_segment",
    "title": "Build the segment",
    "parent": {
     "map": "m_root",
     "step": "n2"
    },
    "lanes": [
     {
      "id": "g_mkt",
      "name": "Marketer",
      "type": "person"
     },
     {
      "id": "g_crm",
      "name": "CRM",
      "type": "system"
     }
    ],
    "steps": [
     {
      "id": "g1",
      "lane": "g_mkt",
      "label": "Choose criteria: industry, stage, last activity",
      "kind": "start",
      "uses": [],
      "next": [
       {
        "to": "g2"
       }
      ]
     },
     {
      "id": "g2",
      "lane": "g_crm",
      "label": "Pull matching contacts",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "g3"
       }
      ]
     },
     {
      "id": "g3",
      "lane": "g_crm",
      "label": "Has email consent?",
      "kind": "decision",
      "uses": [],
      "next": [
       {
        "to": "g4",
        "label": "Yes"
       },
       {
        "to": "g5",
        "label": "No"
       }
      ]
     },
     {
      "id": "g4",
      "lane": "g_crm",
      "label": "Add to the segment",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "g6"
       }
      ]
     },
     {
      "id": "g5",
      "lane": "g_crm",
      "label": "Leave them out",
      "kind": "task",
      "uses": [],
      "next": [
       {
        "to": "g6"
       }
      ]
     },
     {
      "id": "g6",
      "lane": "g_mkt",
      "label": "Segment ready",
      "kind": "end",
      "uses": [],
      "next": []
     }
    ]
   }
  },
  "chat": [],
  "events": []
 }
];
