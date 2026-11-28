// Command terraform-provider-v19 is a read-only Terraform provider for V19 workspace configuration.
package main

import (
	"context"
	"flag"
	"log"

	"github.com/hashicorp/terraform-plugin-framework/providerserver"

	"github.com/visionxixlabs/terraform-provider-v19/internal/provider"
)

var version = "dev"

func main() {
	var debug bool
	flag.BoolVar(&debug, "debug", false, "run with support for debuggers")
	flag.Parse()
	err := providerserver.Serve(context.Background(), provider.New(version), providerserver.ServeOpts{
		Address: "registry.terraform.io/visionxixlabs/v19",
		Debug:   debug,
	})
	if err != nil {
		log.Fatal(err)
	}
}
