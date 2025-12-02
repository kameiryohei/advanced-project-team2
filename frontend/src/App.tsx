import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { ShelterDashboard } from "@/components/shelter-dashboard";
import { ShelterOverview } from "@/components/shelter-overview";
import { Button } from "@/components/ui/button";

export default function HomePage() {
	const [selectedShelter, setSelectedShelter] = useState<string | null>(null);

	if (selectedShelter) {
		return (
			<main className="min-h-screen bg-background">
				<div className="p-4 border-b bg-card">
					<Button
						variant="ghost"
						onClick={() => setSelectedShelter(null)}
						className="flex items-center space-x-2"
					>
						<ArrowLeft className="h-4 w-4" />
						<span>避難所一覧に戻る</span>
					</Button>
				</div>
				<ShelterDashboard shelterId={selectedShelter} />
			</main>
		);
	}

	return (
		<main className="min-h-screen bg-background">
			<ShelterOverview onShelterSelect={setSelectedShelter} />
		</main>
	);
}
