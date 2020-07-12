import React, { useState } from 'react';
import { Collapse, Checkbox } from 'antd';

const { Panel } = Collapse;

function CheckBox(props) {
    const [Checked, setChecked] = useState([]);

    const handleToggle = (value) => {
        //選択されたIndexを持って来て
        const currentIndex = Checked.indexOf(value);
        //全てCheckedされたStateで現在押したCheckboxがもうあれば
        const newChecked = [...Checked];

        // Stateに入れる。
        if (currentIndex === -1) {
            newChecked.push(value);
        } else {
            newChecked.splice(currentIndex, 1);
        }
        setChecked(newChecked);
        props.handleFilters(newChecked);
    };

    const renderCheckboxLists = () =>
        props.list &&
        props.list.map((value, index) => (
            <React.Fragment key={index}>
                <Checkbox onChange={() => handleToggle(value._id)} checked={Checked.indexOf(value._id) === -1 ? false : true} />
                <span>{value.name}</span>
            </React.Fragment>
        ));

    return (
        <div>
            <Collapse defaultActiveKey={['0']}>
                <Panel header="Continents" key="1">
                    {renderCheckboxLists()}
                </Panel>
            </Collapse>
        </div>
    );
}

export default CheckBox;
