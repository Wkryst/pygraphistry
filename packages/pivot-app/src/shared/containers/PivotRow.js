import { container } from '@graphistry/falcor-react-redux';
import { tcell as tableCellClassName,
         splice as spliceIconClassName,
         insert as insertIconClassName,
         search as searchIconClassName } from './styles.less';
import { setPivotValue, togglePivot } from '../actions/PivotRow';
import { Button, Glyphicon, ButtonGroup, Badge } from 'react-bootstrap'
import RcSwitch from 'rc-switch';
import styles from './styles.less';

function ResultCount({ index, resultCount, splicePivot, searchPivot, insertPivot }) {
    return (
        <div>
        <ButtonGroup style={{float:'right'}} >
            <Button onClick={(ev) => insertPivot({index})}><Glyphicon glyph="plus" /></Button>
            <Button onClick={(ev) => splicePivot({index})}><Glyphicon glyph="minus" /></Button>
            <Button onClick={(ev) => searchPivot({index})}><Glyphicon glyph="search" /></Button>
            <Button ><Glyphicon glyph="calendar" /></Button>
            <Button ><Glyphicon glyph="cog" /></Button>
        </ButtonGroup>
        <Badge> {resultCount} </Badge>
        </div>
    );
}

function renderPivotRow({id, index, enabled, resultCount, length, fields, searchPivot, togglePivot, setPivotValue, splicePivot, insertPivot}) {
    return (
        <tr>
            <td className={styles.pivotToggle}>
                <RcSwitch defaultChecked={false}
                          checked={enabled}
                          checkedChildren={'On'}
                          onChange={(ev) => {
                              togglePivot({ index, enabled: ev })}
                          }
                          unCheckedChildren={'Off'}/>
            </td>
        {fields.map((field, index) =>
            <td key={`${id}: ${index}`} style={ index > 0 ? {display: 'none'} : {} }
                className={styles['pivotData' + index]}
            >
                <div className={tableCellClassName}>
                    <input
                        type='th'
                        defaultValue={field.value}
                        readOnly={false}
                        disabled={false}
                        onChange={
                            (ev) => (ev.preventDefault() ||
                                setPivotValue({index, target: ev.target.value}))
                        }
                    />
                </div>
            </td>
            )
        }
            <td className={styles.pivotIcons}>
                <ResultCount index={index} resultCount={resultCount} searchPivot={searchPivot}
                    insertPivot={insertPivot} splicePivot={splicePivot}/>
            </td>

        </tr>
    );
}

function mapStateToFragment({length = 0} = {}) {
    return `{
        'enabled', 'resultCount', 'id', 'length', [0...${length}]: {
            value
        }
    }`;
}

function mapFragmentToProps(fragment) {
    //const output =  { pivots: fragment, name: fragment.name, length: fragment.length};
    //console.log('output', output);
    const {id, length, resultCount, enabled} = fragment;
    return {id, length, fields:fragment, enabled, resultCount};
}

export default container(
        mapStateToFragment,
        mapFragmentToProps,
    {setPivotValue: setPivotValue,
    togglePivot: togglePivot}
)(renderPivotRow);

