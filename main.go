package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"
)

// Agent is a minimal example of a Go agent. Extend this struct as needed.
type Agent struct{}

func (a *Agent) Run() {
	fmt.Println("Agent is running. Press Ctrl+C to exit.")
	// Main loop, replace with agent logic
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	fmt.Println("Agent shutting down.")
}

func main() {
	agent := &Agent{}
	agent.Run()
}

