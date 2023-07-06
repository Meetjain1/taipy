/*
 * Copyright 2023 Avaiga Private Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

import React, { useCallback, SyntheticEvent, useState, useEffect, useMemo, ComponentType, MouseEvent } from "react";
import { Theme, alpha } from "@mui/material";
import Badge, { BadgeOrigin } from "@mui/material/Badge";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import { ChevronRight, ExpandMore, FlagOutlined, PushPinOutlined } from "@mui/icons-material";
import TreeItem from "@mui/lab/TreeItem";
import TreeView from "@mui/lab/TreeView";

import {
    useDispatch,
    useModule,
    getUpdateVar,
    createSendUpdateAction,
    useDispatchRequestUpdateOnFirstRender,
    createRequestUpdateAction,
} from "taipy-gui";

import { Cycles, Cycle, DataNodes, NodeType, Scenarios, Scenario, DataNode, Pipeline } from "./utils/types";
import {
    Cycle as CycleIcon,
    Datanode as DatanodeIcon,
    Pipeline as PipelineIcon,
    Scenario as ScenarioIcon,
} from "./icons";
import { BadgePos, BadgeSx, BaseTreeViewSx, FlagSx, ParentItemSx, tinyIconButtonSx } from "./utils";

export interface EditProps {
    id: string;
}

type Entities = Cycles | Scenarios | DataNodes;
type Entity = Cycle | Scenario | Pipeline | DataNode;
type Pinned = Record<string, boolean>;

interface CoreSelectorProps {
    id?: string;
    updateVarName?: string;
    entities?: Entities;
    coreChanged?: Record<string, unknown>;
    updateVars: string;
    onChange?: string;
    error?: string;
    displayCycles?: boolean;
    showPrimaryFlag?: boolean;
    propagate?: boolean;
    value?: string;
    defaultValue?: string;
    height: string;
    libClassName?: string;
    className?: string;
    dynamicClassName?: string;
    multiple?: boolean;
    lovPropertyName: string;
    leafType: NodeType;
    editComponent?: ComponentType<EditProps>;
    showPins?: boolean;
}

const treeItemLabelSx = {
    display: "flex",
    alignItems: "center",
    gap: 1,
};

const tinyPinIconButtonSx = (theme: Theme) => ({
    ...tinyIconButtonSx,
    backgroundColor: alpha(theme.palette.text.secondary, 0.15),
    color: "text.secondary",

    "&:hover": {
        backgroundColor: alpha(theme.palette.secondary.main, 0.75),
        color: "secondary.contrastText",
    },
});

const tinySelPinIconButtonSx = (theme: Theme) => ({
    ...tinyIconButtonSx,
    backgroundColor: "secondary.main",
    color: "secondary.contrastText",

    "&:hover": {
        backgroundColor: alpha(theme.palette.secondary.main, 0.75),
        color: "secondary.contrastText",
    },
});

const switchBoxSx = {ml: 2};

const CoreItem = (props: {
    item: Entity;
    displayCycles: boolean;
    showPrimaryFlag: boolean;
    leafType: NodeType;
    editComponent?: ComponentType<EditProps>;
    pins: [Pinned, Pinned];
    onPin?: (e: MouseEvent<HTMLElement>) => void;
    hideNonPinned: boolean;
}) => {
    const [id, label, items = [], nodeType, primary] = props.item;
    const isPinned = props.pins[0][id];
    const isShown = props.hideNonPinned ? props.pins[1][id] : true;

    return !props.displayCycles && nodeType === NodeType.CYCLE ? (
        <>
            {items.map((item) => (
                <CoreItem
                    key={item[0]}
                    item={item}
                    displayCycles={false}
                    showPrimaryFlag={props.showPrimaryFlag}
                    leafType={props.leafType}
                    pins={props.pins}
                    onPin={props.onPin}
                    hideNonPinned={props.hideNonPinned}
                />
            ))}
        </>
    ) : isShown ? (
        <TreeItem
            key={id}
            nodeId={id}
            data-selectable={nodeType === props.leafType}
            label={
                <Grid container alignItems="center" direction="row" flexWrap="nowrap" spacing={1}>
                    <Grid item xs sx={treeItemLabelSx}>
                        {nodeType === NodeType.CYCLE ? (
                            <CycleIcon fontSize="small" color="primary" />
                        ) : nodeType === NodeType.SCENARIO ? (
                            props.showPrimaryFlag && primary ? (
                                <Badge
                                    badgeContent={<FlagOutlined sx={FlagSx} />}
                                    color="primary"
                                    anchorOrigin={BadgePos as BadgeOrigin}
                                    sx={BadgeSx}
                                >
                                    <ScenarioIcon fontSize="small" color="primary" />
                                </Badge>
                            ) : (
                                <ScenarioIcon fontSize="small" color="primary" />
                            )
                        ) : nodeType === NodeType.PIPELINE ? (
                            <PipelineIcon fontSize="small" color="primary" />
                        ) : (
                            <DatanodeIcon fontSize="small" color="primary" />
                        )}
                        {label}
                    </Grid>
                    {props.editComponent && nodeType === props.leafType ? (
                        <Grid item xs="auto">
                            <props.editComponent id={id} />
                        </Grid>
                    ) : null}
                    {props.onPin ? (
                        <Grid item xs="auto">
                            <IconButton
                                data-id={id}
                                data-pinned={isPinned ? "pinned" : undefined}
                                onClick={props.onPin}
                                sx={isPinned ? tinySelPinIconButtonSx : tinyPinIconButtonSx}
                            >
                                <PushPinOutlined />
                            </IconButton>
                        </Grid>
                    ) : null}
                </Grid>
            }
            sx={nodeType === NodeType.NODE ? undefined : ParentItemSx}
        >
            {items.map((item) => (
                <CoreItem
                    key={item[0]}
                    item={item}
                    displayCycles={true}
                    showPrimaryFlag={props.showPrimaryFlag}
                    leafType={props.leafType}
                    editComponent={props.editComponent}
                    pins={props.pins}
                    onPin={props.onPin}
                    hideNonPinned={props.hideNonPinned}
                />
            ))}
        </TreeItem>
    ) : null;
};

const findEntityAndParents = (
    id: string,
    tree: Entity[],
    parentIds: Entity[] = []
): [Entity, Entity[], string[]] | undefined => {
    for (const entity of tree) {
        if (entity[0] === id) {
            return [entity, parentIds, getChildrenIds(entity)];
        }
        if (entity[2]) {
            const res = findEntityAndParents(id, entity[2], [entity, ...parentIds]);
            if (res) {
                return res;
            }
        }
    }
};

const getChildrenIds = (entity: Entity): string[] => {
    const res: string[] = [];
    entity[2]?.forEach((child) => {
        res.push(child[0]);
        res.push(...getChildrenIds(child));
    });
    return res;
};

const CoreSelector = (props: CoreSelectorProps) => {
    const {
        id = "",
        entities,
        displayCycles = true,
        showPrimaryFlag = true,
        propagate = true,
        multiple = false,
        lovPropertyName,
        leafType,
        value,
        defaultValue,
        showPins = true,
    } = props;

    const [selected, setSelected] = useState("");
    const [pins, setPins] = useState<[Pinned, Pinned]>([{}, {}]);
    const [hideNonPinned, setShowPinned] = useState(false);

    const dispatch = useDispatch();
    const module = useModule();

    useDispatchRequestUpdateOnFirstRender(dispatch, id, module, props.updateVars);

    const onSelect = useCallback(
        (e: SyntheticEvent, nodeId: string) => {
            const { selectable = "false" } = e.currentTarget.parentElement?.dataset || {};
            const scenariosVar = getUpdateVar(props.updateVars, lovPropertyName);
            dispatch(
                createSendUpdateAction(
                    props.updateVarName,
                    selectable === "true" ? nodeId : undefined,
                    module,
                    props.onChange,
                    propagate,
                    scenariosVar
                )
            );
            setSelected(nodeId);
        },
        [props.updateVarName, props.updateVars, props.onChange, propagate, dispatch, module, lovPropertyName]
    );

    const unselect = useCallback(() => {
        setSelected((sel) => {
            if (sel) {
                const lovVar = getUpdateVar(props.updateVars, lovPropertyName);
                dispatch(
                    createSendUpdateAction(props.updateVarName, undefined, module, props.onChange, propagate, lovVar)
                );
                return "";
            }
            return sel;
        });
    }, [props.updateVarName, props.updateVars, props.onChange, propagate, dispatch, module, lovPropertyName]);

    useEffect(() => {
        if (value !== undefined && value !== null) {
            setSelected(value);
        } else if (defaultValue) {
            try {
                const parsedValue = JSON.parse(defaultValue);
                if (Array.isArray(parsedValue)) {
                    parsedValue.length && setSelected(parsedValue[0]);
                } else {
                    setSelected(parsedValue);
                }
            } catch {
                setSelected(defaultValue);
            }
        } else if (value === null) {
            setSelected("");
        }
    }, [defaultValue, value]);

    useEffect(() => {
        if (entities && !entities.length) {
            unselect();
        }
    }, [entities, unselect]);

    // Refresh on broadcast
    useEffect(() => {
        if (props.coreChanged?.scenario) {
            const updateVar = getUpdateVar(props.updateVars, lovPropertyName);
            updateVar && dispatch(createRequestUpdateAction(id, module, [updateVar], true));
        }
    }, [props.coreChanged, props.updateVars, module, dispatch, id, lovPropertyName]);

    const treeViewSx = useMemo(() => ({ ...BaseTreeViewSx, maxHeight: props.height || "50vh" }), [props.height]);

    const onShowPinsChange = useCallback(() => setShowPinned((sp) => !sp), []);

    const onPin = useCallback(
        (e: MouseEvent<HTMLElement>) => {
            e.stopPropagation();
            if (showPins && props.entities) {
                const { id = "", pinned = "" } = e.currentTarget.dataset || {};
                if (!id) {
                    return;
                }
                const [entity = undefined, parents = [], childIds = []] =
                    findEntityAndParents(id, props.entities) || [];
                if (!entity) {
                    return;
                }
                setPins(([pins, shows]) => {
                    if (pinned === "pinned") {
                        delete pins[id];
                        delete shows[id];
                        for (const parent of parents) {
                            const pinned = ((parent[2] as Entity[]) || []).some((child) => shows[child[0]]);
                            if (!pinned) {
                                delete shows[parent[0]];
                            } else {
                                break;
                            }
                        }
                        parents.forEach((parent) => delete pins[parent[0]]);
                        childIds.forEach((cId) => {
                            delete pins[cId];
                            delete shows[cId];
                        });
                    } else {
                        pins[id] = true;
                        shows[id] = true;
                        for (const parent of parents) {
                            const nonPinned = ((parent[2] as Entity[]) || []).some((child) => !pins[child[0]]);
                            if (!nonPinned) {
                                pins[parent[0]] = true;
                            } else {
                                break;
                            }
                        }
                        parents.forEach((p) => (shows[p[0]] = true));
                        childIds.forEach((cId) => {
                            pins[cId] = true;
                            shows[cId] = true;
                        });
                    }
                    return [pins, shows];
                });
            }
        },
        [showPins, props.entities]
    );

    return (
        <>
            {showPins ? (
                <Box sx={switchBoxSx}>
                    <FormControlLabel
                        control={<Switch onChange={onShowPinsChange} checked={hideNonPinned} disabled={!hideNonPinned && !Object.keys(pins[0]).length} />}
                        label="Pinned only"
                    />
                </Box>
            ) : null}
            <TreeView
                defaultCollapseIcon={<ExpandMore />}
                defaultExpandIcon={<ChevronRight />}
                sx={treeViewSx}
                onNodeSelect={onSelect}
                selected={selected}
                multiSelect={multiple && !multiple}
            >
                {entities
                    ? entities.map((item) => (
                          <CoreItem
                              key={item[0]}
                              item={item}
                              displayCycles={displayCycles}
                              showPrimaryFlag={showPrimaryFlag}
                              leafType={leafType}
                              editComponent={props.editComponent}
                              onPin={showPins ? onPin : undefined}
                              pins={pins}
                              hideNonPinned={hideNonPinned}
                          />
                      ))
                    : null}
            </TreeView>
        </>
    );
};

export default CoreSelector;
