package provider

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

type policyResource struct{ client *Client }

// NewPolicyResource is the v19_policy resource.
func NewPolicyResource() resource.Resource { return &policyResource{} }

type policyModel struct {
	ID        types.String `tfsdk:"id"`
	Document  types.String `tfsdk:"document"`
	RequestID types.String `tfsdk:"request_id"`
	Status    types.String `tfsdk:"status"`
}

func (r *policyResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_policy"
}

func (r *policyResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "The workspace's policy file (rules and release autopilot). Applying proposes the change; it takes effect only after a different owner or admin approves it in Governance → Policy as code. Until then status is pending.",
		Attributes: map[string]schema.Attribute{
			"id":         schema.StringAttribute{Computed: true, PlanModifiers: []planmodifier.String{stringplanmodifier.UseStateForUnknown()}},
			"document":   schema.StringAttribute{Required: true, Description: "The policy file as JSON (kind v19.policy, version 1). Use jsonencode() or file()."},
			"request_id": schema.StringAttribute{Computed: true, Description: "The pending policy change request, or empty when the policy already matches."},
			"status":     schema.StringAttribute{Computed: true, Description: "applied, pending, rejected or stale."},
		},
	}
}

func (r *policyResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}
	client, ok := req.ProviderData.(*Client)
	if !ok {
		resp.Diagnostics.AddError("Unexpected provider data", fmt.Sprintf("expected *Client, got %T", req.ProviderData))
		return
	}
	r.client = client
}

func (r *policyResource) propose(ctx context.Context, plan *policyModel) error {
	request, unchanged, err := r.client.ProposePolicy(ctx, json.RawMessage(plan.Document.ValueString()))
	if err != nil {
		return err
	}
	plan.ID = types.StringValue("policy")
	if unchanged {
		plan.RequestID = types.StringValue("")
		plan.Status = types.StringValue("applied")
		return nil
	}
	plan.RequestID = types.StringValue(request.ID)
	plan.Status = types.StringValue(request.Status)
	return nil
}

func (r *policyResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan policyModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}
	if err := r.propose(ctx, &plan); err != nil {
		resp.Diagnostics.AddError("Could not propose the V19 policy", err.Error())
		return
	}
	if plan.Status.ValueString() == "pending" {
		resp.Diagnostics.AddWarning("Policy change waits for approval", "A different owner or admin must approve request "+plan.RequestID.ValueString()+" in Governance → Policy as code before it takes effect.")
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, plan)...)
}

func (r *policyResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan policyModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}
	if err := r.propose(ctx, &plan); err != nil {
		resp.Diagnostics.AddError("Could not propose the V19 policy", err.Error())
		return
	}
	if plan.Status.ValueString() == "pending" {
		resp.Diagnostics.AddWarning("Policy change waits for approval", "A different owner or admin must approve request "+plan.RequestID.ValueString()+" in Governance → Policy as code before it takes effect.")
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, plan)...)
}

// Read reports what is in force. A pending proposal keeps the configured document (no endless diff);
// a rejected or stale one, or a change made in the cockpit, shows as drift so the next apply proposes again.
func (r *policyResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state policyModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}
	current, err := r.client.GetPolicy(ctx)
	if err != nil {
		resp.Diagnostics.AddError("Could not read the V19 policy", err.Error())
		return
	}
	next := policyReadState(state, current, func(id string) (PolicyRequest, error) { return r.client.GetPolicyRequest(ctx, id) })
	resp.Diagnostics.Append(resp.State.Set(ctx, next)...)
}

// policyReadState is the pure part of Read, so it can be tested without Terraform.
func policyReadState(state policyModel, current json.RawMessage, lookup func(string) (PolicyRequest, error)) policyModel {
	if SamePolicy(current, json.RawMessage(state.Document.ValueString())) {
		state.Status = types.StringValue("applied")
		state.RequestID = types.StringValue("")
		return state
	}
	if id := state.RequestID.ValueString(); id != "" {
		if request, err := lookup(id); err == nil && request.Status == "pending" {
			state.Status = types.StringValue("pending")
			return state
		} else if err == nil {
			state.Status = types.StringValue(request.Status)
		}
	}
	state.Document = types.StringValue(string(current))
	return state
}

// Delete only forgets the resource: V19 keeps its policy, which is changed through a reviewed request.
func (r *policyResource) Delete(_ context.Context, _ resource.DeleteRequest, resp *resource.DeleteResponse) {
	resp.Diagnostics.AddWarning("Policy left in place", "Removing v19_policy from Terraform does not change the workspace's policy. Propose a new policy file to change it.")
}

func (r *policyResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	current, err := r.client.GetPolicy(ctx)
	if err != nil {
		resp.Diagnostics.AddError("Could not read the V19 policy", err.Error())
		return
	}
	resp.Diagnostics.Append(resp.State.SetAttribute(ctx, path.Root("id"), "policy")...)
	resp.Diagnostics.Append(resp.State.SetAttribute(ctx, path.Root("document"), string(current))...)
	resp.Diagnostics.Append(resp.State.SetAttribute(ctx, path.Root("request_id"), "")...)
	resp.Diagnostics.Append(resp.State.SetAttribute(ctx, path.Root("status"), "applied")...)
}

var _ resource.ResourceWithImportState = &policyResource{}
