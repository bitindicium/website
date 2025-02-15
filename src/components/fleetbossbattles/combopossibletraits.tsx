import React from 'react';
import { Header, Grid, Label, Icon } from 'semantic-ui-react';

import allTraits from '../../../static/structured/translation_en.json';

type ComboPossibleTraitsProps = {
	nodes: any[];
	traits: string[];
};

const ComboPossibleTraits = (props) => {
	const traitsConsumed = [];
	props.nodes.forEach(node => {
		if (!node.hidden_traits.includes('?')) {
			node.hidden_traits.forEach(trait => {
				if (trait !== '?') traitsConsumed.push(trait);
			});
		}
	});

	const traitList = [];
	props.traits.forEach((trait, traitIndex) => {
		const instance = traitList.filter(t => t.trait === trait).length+1;
		traitList.push({
			id: traitIndex,
			trait,
			instance,
			consumed: traitsConsumed.filter(t => t === trait).length >= instance,
			name: allTraits.trait_names[trait]
		});
	});
	traitList.forEach(trait => {
		trait.count = traitList.filter(t => t.trait === trait.trait).length;
	});

	return (
		<div style={{ margin: '2em 0' }}>
			<Header as='h4'>Possible Traits</Header>
			<p>This table should match the list of possible traits in-game.</p>
			<Grid doubling columns={6} style={{ margin: '1em 0' }}>
				{traitList.map(trait =>
					<Grid.Column key={trait.id} style={{ textAlign: 'center', padding: '1px' }}>
						<Label size='large'>
							{trait.consumed && <Icon name='check' color='green' />}
							{trait.name}{trait.count > 1 ? ` (${trait.instance})`: ''}
						</Label>
					</Grid.Column>
				)}
			</Grid>
		</div>
	);
};

export default ComboPossibleTraits;
