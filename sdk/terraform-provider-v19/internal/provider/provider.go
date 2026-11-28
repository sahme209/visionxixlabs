package provider

import (
	"context"
	"os"

	"github.com/hashicorp/terraform-plugin-framework/datasource"
	"github.com/hashicorp/terraform-plugin-framework/provider"
	"github.com/hashicorp/terraform-plugin-framework/provider/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

const defaultEndpoint = "https://visionxixlabs.com"

type v19Provider struct{ version string }

type providerModel struct {
	Endpoint types.String `tfsdk:"endpoint"`
	APIKey   types.String `tfsdk:"api_key"`
}

// New returns the provider factory.
func New(version string) func() provider.Provider {
	return func() provider.Provider { return &v19Provider{version: version} }
}

func (p *v19Provider) Metadata(_ context.Context, _ provider.MetadataRequest, resp *provider.MetadataResponse) {
	resp.TypeName = "v19"
	resp.Version = p.version
}

func (p *v19Provider) Schema(_ context.Context, _ provider.SchemaRequest, resp *provider.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "V19 workspace configuration. Reads environments, variables and deployment checks; proposes policy changes, which a different workspace admin approves before they apply.",
		Attributes: map[string]schema.Attribute{
			"endpoint": schema.StringAttribute{Optional: true, Description: "V19 address. Defaults to V19_ENDPOINT or https://visionxixlabs.com."},
			"api_key":  schema.StringAttribute{Optional: true, Sensitive: true, Description: "API key with the config:read scope (and policy:propose for v19_policy). Defaults to V19_API_KEY."},
		},
	}
}

func (p *v19Provider) Configure(ctx context.Context, req provider.ConfigureRequest, resp *provider.ConfigureResponse) {
	var cfg providerModel
	resp.Diagnostics.Append(req.Config.Get(ctx, &cfg)...)
	if resp.Diagnostics.HasError() {
		return
	}
	endpoint := firstNonEmpty(cfg.Endpoint.ValueString(), os.Getenv("V19_ENDPOINT"), defaultEndpoint)
	key := firstNonEmpty(cfg.APIKey.ValueString(), os.Getenv("V19_API_KEY"))
	clean, err := ValidateEndpoint(endpoint)
	if err != nil {
		resp.Diagnostics.AddError("Invalid V19 endpoint", err.Error())
		return
	}
	if key == "" {
		resp.Diagnostics.AddError("Missing V19 API key", "Set api_key or the V19_API_KEY environment variable to a key with the config:read scope.")
		return
	}
	client := &Client{Endpoint: clean, APIKey: key}
	resp.DataSourceData = client
	resp.ResourceData = client
}

func (p *v19Provider) Resources(context.Context) []func() resource.Resource {
	return []func() resource.Resource{NewPolicyResource}
}

func (p *v19Provider) DataSources(context.Context) []func() datasource.DataSource {
	return []func() datasource.DataSource{NewConfigDataSource}
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
