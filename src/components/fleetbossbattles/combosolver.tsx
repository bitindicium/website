import React from 'react';
import { Step, Icon, Message } from 'semantic-ui-react';

import ComboNodesTable from './combonodestable';
import ComboPossibleTraits from './combopossibletraits';
import ComboCrewTable from './combocrewtable';
import ComboChecklist from './combochecklist';
import { ExportTraits, ExportCrewLists } from './exporter';

const MAX_RARITY_BY_DIFFICULTY = {
	1: 2,
	2: 3,
	3: 4,
	4: 4,
	5: 5,
	6: 5
};

type ComboSolverProps = {
	allCrew: string[];
	combo: any;
};

const ComboSolver = (props: ComboSolverProps) => {
	const [activeStep, setActiveStep] = React.useState('crew');
	const [combo, setCombo] = React.useState(undefined);
	const [openNodes, setOpenNodes] = React.useState(undefined);
	const [traitPool, setTraitPool] = React.useState([]);
	const [allMatchingCrew, setAllMatchingCrew] = React.useState([]);
	const [attemptedCrew, setAttemptedCrew] = React.useState([]);

	React.useEffect(() => {
		if (props.combo) {
			setCombo({...props.combo});
			if (combo && combo.id !== props.combo.id) setAttemptedCrew([]);
		}
	}, [props.combo]);

	React.useEffect(() => {
		if (!combo) return;

		// The trait pool consists of only remaining possible hidden_traits
		const traits = {};
		combo.traits.forEach(trait => {
			if (!traits[trait]) traits[trait] = { listed: 0, consumed: 0 };
			traits[trait].listed++;
		});

		const openNodes = [];
		let current = false;
		combo.nodes.forEach((node, nodeIndex) => {
			const nodeIsOpen = node.hidden_traits.includes('?');
			const traitsKnown = node.open_traits.slice();
			let hiddenLeft = node.hidden_traits.length;
			node.hidden_traits.forEach(trait => {
				if (trait !== '?') {
					traits[trait].consumed++;
					if (nodeIsOpen) {
						traitsKnown.push(trait);
						hiddenLeft--;
					}
				}
			});
			if (nodeIsOpen) {
				openNodes.push({
					comboId: combo.id,
					index: nodeIndex,
					traitsKnown,
					hiddenLeft
				});
			}
			// You have already solved a node for this chain; not currently used by this tool
			if (node.unlocked_character?.is_current) current = true;
		});

		const traitPool = [];
		combo.traits.forEach(trait => {
			if (!traitPool.includes(trait) && traits[trait].consumed < traits[trait].listed)
				traitPool.push(trait);
		});

		setOpenNodes([...openNodes]);
		setTraitPool([...traitPool]);
	}, [combo]);

	React.useEffect(() => {
		if (!combo) return;

		const getAllCombos = (traits, count) => {
			if (count === 1) return traits.map(trait => [trait]);
			const combos = [];
			for (let i = 0; i < traits.length; i++) {
				for (let j = i+1; j < traits.length; j++) {
					combos.push([traits[i], traits[j]]);
				}
			}
			return combos;
		};

		const findCombo = (combos, combo) => {
			let comboIndex = -1;
			for (let i = 0; i < combos.length; i++) {
				if (combos[i].every(trait => combo.includes(trait))) {
					comboIndex = i;
					continue;
				}
			}
			return comboIndex;
		};

		const allMatchingCrew = [];
		props.allCrew.forEach(crew => {
			if (crew.max_rarity <= MAX_RARITY_BY_DIFFICULTY[combo.difficultyId]) {
				const nodes = [];
				const matchesByNode = {};
				openNodes.forEach(node => {
					// Crew must have every known trait
					if (node.traitsKnown.every(trait => crew.traits.includes(trait))) {
						const nodePool = traitPool.filter(trait => !node.traitsKnown.includes(trait));
						const traitsMatched = nodePool.filter(trait => crew.traits.includes(trait));
						// Crew must have at least the same number of matching traits as remaining hidden traits
						if (traitsMatched.length >= node.hiddenLeft) {
							nodes.push(node.index);
							const combos = getAllCombos(traitsMatched, node.hiddenLeft);
							matchesByNode[`node-${node.index}`] = { index: node.index, traits: traitsMatched, combos };
						}
					}
				});
				if (nodes.length > 0) {
					const matchedCrew = JSON.parse(JSON.stringify(crew));
					matchedCrew.nodes = nodes;
					matchedCrew.nodes_rarity = nodes.length;
					matchedCrew.node_matches = matchesByNode;
					allMatchingCrew.push(matchedCrew);
				}
			}
		});

		const ignoredCombos = [];
		const ignoreCombo = (nodeIndex, combo) => {
			if (!ignoredCombos.find(ignored => ignored.index === nodeIndex && ignored.combo.every(trait => combo.includes(trait))))
				ignoredCombos.push({ index: nodeIndex, combo });
		};

		// Ignore combos of attempted crew
		attemptedCrew.forEach(attempt => {
			const crew = props.allCrew.find(ac => ac.symbol === attempt);
			openNodes.forEach(node => {
				if (node.traitsKnown.every(trait => crew.traits.includes(trait))) {
					const nodePool = traitPool.filter(trait => !node.traitsKnown.includes(trait));
					const traitsMatched = nodePool.filter(trait => crew.traits.includes(trait));
					const combos = getAllCombos(traitsMatched, node.hiddenLeft);
					combos.forEach(combo => ignoreCombo(node.index, combo));
				}
			});
		});

		// Also ignore unique combos of non-portal crew
		const nonPortals = allMatchingCrew.filter(crew => !crew.in_portal);
		if (nonPortals.length > 0) {
			openNodes.forEach(node => {
				const nonPortalsByNode = nonPortals.filter(crew => crew.nodes.includes(node.index));
				if (nonPortalsByNode.length > 0) {
					const portalsByNode = allMatchingCrew.filter(crew => crew.in_portal && crew.nodes.includes(node.index));
					nonPortals.forEach(nonportal => {
						if (nonportal.nodes.includes(node.index)) {
							nonportal.node_matches[`node-${node.index}`].combos.forEach(combo => {
								if (!portalsByNode.some(portal => findCombo(portal.node_matches[`node-${node.index}`].combos, combo) >= 0))
									ignoreCombo(node.index, combo);
							});
						}
					});
				}
			});
		}

		// Validate matching combos and traits, factoring ignored combos
		ignoredCombos.forEach(ignored => {
			const crewWithCombo = allMatchingCrew.filter(crew =>
				crew.nodes.includes(ignored.index) && findCombo(crew.node_matches[`node-${ignored.index}`].combos, ignored.combo) >= 0
			);
			crewWithCombo.forEach(crew => {
				const crewMatches = crew.node_matches[`node-${ignored.index}`];
				const comboIndex = findCombo(crewMatches.combos, ignored.combo);
				crewMatches.combos.splice(comboIndex, 1);
				if (crewMatches.combos.length > 0) {
					const validTraits = [];
					crewMatches.combos.forEach(combo => {
						combo.forEach(trait => {
							if (!validTraits.includes(trait)) validTraits.push(trait);
						});
					});
					crewMatches.traits = validTraits;
				}
				else {
					const nodeIndex = crew.nodes.indexOf(ignored.index);
					crew.nodes.splice(nodeIndex, 1);
					delete crew.node_matches[`node-${ignored.index}`]
					crew.nodes_rarity--;
				}
			});
		});

		const validatedCrew = allMatchingCrew.filter(crew => crew.nodes_rarity > 0);
		setAllMatchingCrew([...validatedCrew]);
	}, [traitPool, attemptedCrew]);

	if (!combo || !openNodes)
		return (<></>);

	return (
		<React.Fragment>
			<Step.Group>
				<Step active={activeStep === 'crew' && openNodes.length > 0} onClick={() => setActiveStep('crew')}>
					<Icon name='users' />
					<Step.Content>
						<Step.Title>Crew</Step.Title>
						<Step.Description>Search for possible crew</Step.Description>
					</Step.Content>
				</Step>
				<Step active={activeStep === 'traits' || openNodes.length === 0} onClick={() => setActiveStep('traits')}>
					<Icon name='tasks' />
					<Step.Content>
						<Step.Title>Traits</Step.Title>
						<Step.Description>View current combo chain</Step.Description>
					</Step.Content>
				</Step>
			</Step.Group>
			{activeStep === 'crew' && openNodes.length > 0 &&
				<React.Fragment>
					<ComboCrewTable
						comboId={combo.id} openNodes={openNodes} traitPool={traitPool}
						allMatchingCrew={allMatchingCrew}
						solveNode={onNodeSolved} markAsTried={onCrewMarked}
					/>
					<ComboChecklist comboId={combo.id} crewList={props.allCrew} attemptedCrew={attemptedCrew} updateAttempts={setAttemptedCrew} />
					<ExportCrewLists openNodes={openNodes} allMatchingCrew={allMatchingCrew} />
				</React.Fragment>
			}
			{(activeStep === 'traits' || openNodes.length === 0) &&
				<React.Fragment>
					{openNodes.length === 0 &&
						<Message positive>
							Your fleet has solved all nodes for this combo chain. Select another boss or update your player data to refresh active battles.
						</Message>
					}
					<ComboNodesTable comboId={combo.id} nodes={combo.nodes} traits={combo.traits} updateNodes={onUpdateNodes} />
					<ComboPossibleTraits nodes={combo.nodes} traits={combo.traits} />
					<ExportTraits nodes={combo.nodes} traits={combo.traits} />
				</React.Fragment>
			}
		</React.Fragment>
	);

	function onUpdateNodes(nodes: any[]): void {
		setCombo({...combo, nodes});
	}

	function onCrewMarked(crewSymbol: string): void {
		if (!attemptedCrew.includes(crewSymbol)) {
			const newAttempts = [...attemptedCrew];
			newAttempts.push(crewSymbol);
			setAttemptedCrew([...newAttempts]);
		}
	}

	function onNodeSolved(nodeIndex: number, traits: string[]): void {
		let solvedIndex = 0;
		const solvedTraits = combo.nodes[nodeIndex].hidden_traits.map(hiddenTrait => {
			if (hiddenTrait === '?') return traits[solvedIndex++];
			return hiddenTrait;
		});
		combo.nodes[nodeIndex].hidden_traits = solvedTraits;
		setCombo({...combo});
	}
};

export default ComboSolver;
