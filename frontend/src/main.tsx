import React from 'react';
import {createRoot} from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './style.css';
import './planner.css';
import {DetailedWorkspace} from './DetailedWorkspace';
import {CitizenPlanner} from './components/CitizenPlanner';

const detailed=new URLSearchParams(window.location.search).get('view')==='advanced';
createRoot(document.getElementById('root')!).render(<React.StrictMode>{detailed?<DetailedWorkspace/>:<CitizenPlanner/>}</React.StrictMode>);
