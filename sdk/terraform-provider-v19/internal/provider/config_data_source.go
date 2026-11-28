package provider

import (
	"context"
	"fmt"

	"github.com/hashicorp/terraform-plugin-framework/datasource"
	"github.com/hashicorp/terraform-plugin-framework/datasource/schema"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

type configDataSource struct{ client *Client }

// NewConfigDataSource is the v19_config data source.
func NewConfigDataSource() datasource.DataSource { return &configDataSource{} }

type environmentModel struct {
	Slug             types.String `tfsdk:"slug"`
	Name             types.String `tfsdk:"name"`
	Tier             types.String `tfsdk:"tier"`
	Tags             types.List   `tfsdk:"tags"`
	ChangeWindowJSON types.String `tfsdk:"change_window_json"`
}

type variableModel struct {
	Key         types.String `tfsdk:"key"`
	Value       types.String `tfsdk:"value"`
	Version     types.Int64  `tfsdk:"version"`
	Scope       types.String `tfsdk:"scope"`
	Environment types.String `tfsdk:"environment"`
	Set         types.String `tfsdk:"set"`
}

type checkModel struct {
	Key      types.String `tfsdk:"key"`
	Name     types.String `tfsdk:"name"`
	Kind     types.String `tfsdk:"kind"`
	Stage    types.String `tfsdk:"stage"`
	Mode     types.String `tfsdk:"mode"`
	Enabled  types.Bool   `tfsdk:"enabled"`
	Version  types.Int64  `tfsdk:"version"`
	SpecJSON types.String `tfsdk:"spec_json"`
}

type configModel struct {
	Environments []environmentModel `tfsdk:"environments"`
	Variables    []variableModel    `tfsdk:"variables"`
	Checks       []checkModel       `tfsdk:"checks"`
}

func (d *configDataSource) Metadata(_ context.Context, req datasource.MetadataRequest, resp *datasource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_config"
}

func (d *configDataSource) Schema(_ context.Context, _ datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	str := func(desc string) schema.StringAttribute { return schema.StringAttribute{Computed: true, Description: desc} }
	resp.Schema = schema.Schema{
		Description: "The workspace's environments, plain configuration variables (secret references stay unresolved) and deployment checks.",
		Attributes: map[string]schema.Attribute{
			"environments": schema.ListNestedAttribute{Computed: true, NestedObject: schema.NestedAttributeObject{Attributes: map[string]schema.Attribute{
				"slug": str("Environment slug."), "name": str("Display name."), "tier": str("Tier, for example prod."),
				"tags":               schema.ListAttribute{Computed: true, ElementType: types.StringType, Description: "key:value tags."},
				"change_window_json": str("Change window and freezes as JSON, or empty when none."),
			}}},
			"variables": schema.ListNestedAttribute{Computed: true, NestedObject: schema.NestedAttributeObject{Attributes: map[string]schema.Attribute{
				"key": str("Variable name."), "value": str("Plain value (secrets are references, never resolved)."),
				"version": schema.Int64Attribute{Computed: true}, "scope": str("workspace, environment or set."),
				"environment": str("Environment slug when scope is environment."), "set": str("Variable set slug when scope is set."),
			}}},
			"checks": schema.ListNestedAttribute{Computed: true, NestedObject: schema.NestedAttributeObject{Attributes: map[string]schema.Attribute{
				"key": str("Check key."), "name": str("Display name."), "kind": str("Check kind."), "stage": str("Release stage."),
				"mode": str("blocking or advisory."), "enabled": schema.BoolAttribute{Computed: true},
				"version": schema.Int64Attribute{Computed: true}, "spec_json": str("Check settings as JSON."),
			}}},
		},
	}
}

func (d *configDataSource) Configure(_ context.Context, req datasource.ConfigureRequest, resp *datasource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}
	client, ok := req.ProviderData.(*Client)
	if !ok {
		resp.Diagnostics.AddError("Unexpected provider data", fmt.Sprintf("expected *Client, got %T", req.ProviderData))
		return
	}
	d.client = client
}

func (d *configDataSource) Read(ctx context.Context, _ datasource.ReadRequest, resp *datasource.ReadResponse) {
	cfg, err := d.client.ReadConfig(ctx)
	if err != nil {
		resp.Diagnostics.AddError("Could not read V19 configuration", err.Error())
		return
	}
	state, diags := toModel(ctx, cfg)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, state)...)
}

func rawString(b []byte) types.String {
	if len(b) == 0 || string(b) == "null" {
		return types.StringValue("")
	}
	return types.StringValue(string(b))
}

func toModel(ctx context.Context, cfg *Config) (configModel, diagList) {
	var out configModel
	var diags diagList
	out.Environments = []environmentModel{}
	for _, e := range cfg.Environments {
		tags, d := types.ListValueFrom(ctx, types.StringType, nonNil(e.Tags))
		diags.Append(d...)
		out.Environments = append(out.Environments, environmentModel{Slug: types.StringValue(e.Slug), Name: types.StringValue(e.Name), Tier: types.StringValue(e.Tier), Tags: tags, ChangeWindowJSON: rawString(e.ChangeWindow)})
	}
	out.Variables = []variableModel{}
	for _, v := range cfg.Variables {
		out.Variables = append(out.Variables, variableModel{Key: types.StringValue(v.Key), Value: types.StringValue(v.Value), Version: types.Int64Value(v.Version), Scope: types.StringValue(v.Scope), Environment: types.StringValue(v.Environment), Set: types.StringValue(v.Set)})
	}
	out.Checks = []checkModel{}
	for _, c := range cfg.Checks.Checks {
		out.Checks = append(out.Checks, checkModel{Key: types.StringValue(c.Key), Name: types.StringValue(c.Name), Kind: types.StringValue(c.Kind), Stage: types.StringValue(c.Stage), Mode: types.StringValue(c.Mode), Enabled: types.BoolValue(c.Enabled), Version: types.Int64Value(c.Version), SpecJSON: rawString(c.Spec)})
	}
	return out, diags
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

