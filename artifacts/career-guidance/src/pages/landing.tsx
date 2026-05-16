import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { BrainCircuit, LineChart, Target, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="px-6 lg:px-14 h-20 flex items-center justify-between border-b border-white/5 bg-background/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <BrainCircuit className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">Lumina</span>
        </div>
        <nav className="flex gap-6">
          <Link href="/login" className="text-sm font-medium hover:text-primary transition-colors flex items-center">
            Log in
          </Link>
          <Button asChild className="rounded-full">
            <Link href="/register">Get Started</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center pt-24 pb-32 px-6">
        <div className="max-w-4xl text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center rounded-full border px-3 py-1 mb-6 text-sm bg-muted/50">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
              Precision career intelligence
            </div>
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-balance leading-tight">
              Data-driven guidance for your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">career trajectory</span>.
            </h1>
            <p className="mt-6 text-xl text-muted-foreground max-w-2xl mx-auto text-balance leading-relaxed">
              Upload your resume and get an intelligent breakdown of your skills, market fit, and a roadmap to your next role.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button size="lg" className="rounded-full text-base px-8 h-14" asChild>
              <Link href="/register">Analyze My Resume</Link>
            </Button>
            <Button size="lg" variant="outline" className="rounded-full text-base px-8 h-14 bg-background" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          </motion.div>
        </div>

        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full">
          {[
            {
              icon: Target,
              title: "Placement Probability",
              desc: "Know exactly where you stand with AI-powered scoring based on market demand.",
            },
            {
              icon: LineChart,
              title: "Skill Gap Analytics",
              desc: "Visualize your strengths and identify missing skills for your target roles.",
            },
            {
              icon: Zap,
              title: "Actionable Roadmaps",
              desc: "Get course recommendations and interview tips tailored to your specific profile.",
            },
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
              className="p-8 rounded-2xl bg-card border border-white/5 shadow-sm"
            >
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}