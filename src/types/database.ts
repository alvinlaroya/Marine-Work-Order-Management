export type UserRole = "Admin" | "Captain" | "Crew";
export type WorkOrderStatus = "Open" | "In Progress" | "Done";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vessel {
  id: string;
  name: string;
  imo_number: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VesselAssignment {
  id: string;
  profile_id: string;
  vessel_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkOrder {
  id: string;
  work_order_number: string;
  title: string;
  issue: string;
  solution: string | null;
  status: WorkOrderStatus;
  vessel_id: string;
  assigned_crew_id: string;
  created_by_id: string;
  attested_at: string | null;
  attested_by_id: string | null;
  is_closed: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderRejection {
  id: string;
  work_order_id: string;
  rejected_by_id: string;
  reason: string;
  created_at: string;
}

export type WorkOrderEventType = "started" | "completed";

/** Crew activity on a work order (started working / marked done). */
export interface WorkOrderEvent {
  id: string;
  work_order_id: string;
  actor_id: string;
  event_type: WorkOrderEventType;
  note: string | null;
  created_at: string;
}

export interface MockSession {
  auth_user_id: string;
  active_profile_id: string;
  active_vessel_id: string | null;
  updated_at: string;
}

interface NameRef {
  full_name: string;
}

/** Work order with the related names the UI displays (PostgREST embeds). */
export interface WorkOrderRow extends WorkOrder {
  vessel: { name: string } | null;
  assignee: NameRef | null;
  creator: NameRef | null;
  attester: NameRef | null;
}

export interface RejectionRow extends WorkOrderRejection {
  rejected_by: NameRef | null;
}

export interface WorkOrderEventRow extends WorkOrderEvent {
  actor: NameRef | null;
}

export interface AssignmentRow extends VesselAssignment {
  profile: Profile | null;
  vessel: Vessel | null;
}
